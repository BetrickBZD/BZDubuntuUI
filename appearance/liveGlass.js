import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';


// Clutter renders an offscreen effect into a texture larger than the actor:
// 2 px before it and 1 px after it on each axis (for an actor on whole
// pixels, which all of ours are). Texture coordinates span that texture,
// so the shape is mapped back onto the actor with this margin.
const EFFECT_MARGIN_START = 2;
const EFFECT_MARGIN = 3;

const MASK_DECLARATIONS = `
uniform vec2 size;
uniform vec2 extent;
uniform float margin;
uniform float radius;
`;
// Signed distance to the rounded rectangle (negative inside, also with a
// radius of 0), antialiased over one pixel
const MASK_CODE = `
vec2 point = cogl_tex_coord_in[0].xy * extent - margin;
vec2 corner = abs(point - size * 0.5) - (size * 0.5 - radius);
float distance = length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - radius;
cogl_color_out *= clamp(0.5 - distance, 0.0, 1.0);
`;

/** Cuts an actor to a rectangle with rounded corners. */
export const RoundedMaskEffect = GObject.registerClass(
class RoundedMaskEffect extends Shell.GLSLEffect {
    _init() {
        super._init();
        this._sizeLocation = this.get_uniform_location('size');
        this._extentLocation = this.get_uniform_location('extent');
        this._radiusLocation = this.get_uniform_location('radius');
        this.set_uniform_float(this.get_uniform_location('margin'), 1, [EFFECT_MARGIN_START]);
    }

    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, MASK_DECLARATIONS, MASK_CODE, false);
    }

    setShape(width, height, radius) {
        this.set_uniform_float(this._sizeLocation, 2, [width, height]);
        this.set_uniform_float(this._extentLocation, 2, [width + EFFECT_MARGIN, height + EFFECT_MARGIN]);
        this.set_uniform_float(this._radiusLocation, 1, [Math.min(radius, width / 2, height / 2)]);
    }
});

/**
 * Frosted glass behind one shell surface, on a layer right below the
 * surface's top-level actor. With `live` it shows what is really behind
 * it, windows included: the layer holds clones of the wallpaper and the
 * windows, blurred and cut to the surface's rounded shape, and is redrawn
 * whenever something behind it changes. Without, it shows the static
 * frosted wallpaper (GlassBackdrop) at the surface's place, like the dock:
 * no clones, no effects, nothing to redraw. Either way the layer is only
 * shown, and only follows the surface, while the surface is on screen, so
 * a closed popup costs nothing. The surface itself gets the
 * bzd-glass-surface class for its translucent tint and rim.
 */
export class LiveGlassSurface {
    constructor(surface, {backdrop, live = false}) {
        this._surface = surface;
        this._backdrop = backdrop;
        this._live = live;
        this._geometry = '';
        this._shape = '';
        // Where the surface is on the stage: [x, y, width, height]
        this._rect = null;
        this._cullLater = 0;
        surface.add_style_class_name('bzd-glass-surface');

        this._clones = [];
        this._layer = new St.Widget({clip_to_allocation: true, visible: false});
        // When the shell shuts down it may destroy the layer before the surface
        this._layer.connect('destroy', () => {
            this._layer = null;
            this._clones = [];
        });
        if (live) {
            // Outermost effect first: blur the windows, then cut the shape
            this._mask = new RoundedMaskEffect();
            this._layer.add_effect(this._mask);
            this._blur = new Shell.BlurEffect({mode: Shell.BlurMode.ACTOR});
            this._layer.add_effect(this._blur);
        }

        surface.connectObject('notify::mapped', () => this._syncMapped(), this);
        this._syncMapped();
    }

    _syncMapped() {
        if (this._surface.mapped) {
            // Every frame while shown, to follow open/close animations
            global.stage.connectObject('before-update', () => this._follow(), this);
            if (this._live) {
                global.window_group.connectObject(
                    'child-added', () => this._rebuild(),
                    'child-removed', () => this._rebuild(),
                    this);
                global.display.connectObject('restacked', () => this._rebuild(), this);
                this._rebuild();
            }
            this._follow();
        } else {
            global.stage.disconnectObject(this);
            global.window_group.disconnectObject(this);
            global.display.disconnectObject(this);
            this._layer?.hide();
            this._clear();
        }
    }

    // The window group itself can't be cloned: it reports a 0x0 size, which
    // a clone would have to scale up infinitely. So its parts are cloned,
    // wallpaper and windows, in stacking order. Hidden ones (minimized, on
    // another workspace) stay hidden in the clone too, and so do those not
    // behind the surface at all (see _cull()).
    _rebuild() {
        this._clear();
        if (!this._layer)
            return;
        for (const source of sceneParts(global.window_group, [])) {
            const clone = new Clutter.Clone({source, visible: false});
            source.connectObject(
                'notify::visible', () => this._queueCull(),
                'notify::allocation', () => this._queueCull(),
                clone);
            this._layer.add_child(clone);
            this._clones.push(clone);
        }
        this._geometry = '';
        this._cull();
    }

    _clear() {
        if (this._cullLater)
            global.compositor.get_laters().remove(this._cullLater);
        this._cullLater = 0;
        for (const clone of this._clones)
            clone.destroy();
        this._clones = [];
    }

    // Outside of the layout pass that moved or resized a window
    _queueCull() {
        if (this._cullLater)
            return;
        this._cullLater = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._cullLater = 0;
            this._cull();
            return GLib.SOURCE_REMOVE;
        });
    }

    // Only windows (and wallpapers) behind the surface are shown in the
    // layer: the blur is redone whenever a shown one changes, so a video
    // playing elsewhere on screen would have it redone every frame for
    // nothing. Judged by where the window is laid out, not where an
    // animation shows it right now, so one still opening counts already.
    _cull() {
        for (const clone of this._clones) {
            const {source} = clone;
            let shown = source.visible;
            if (shown && this._rect) {
                const [parentX, parentY] = source.get_parent()?.get_transformed_position() ?? [0, 0];
                const box = source.get_allocation_box();
                const [x, y, width, height] = this._rect;
                shown = parentX + box.x1 < x + width && x < parentX + box.x2 &&
                    parentY + box.y1 < y + height && y < parentY + box.y2;
            }
            if (clone.visible !== shown)
                clone.visible = shown;
        }
    }

    _follow() {
        if (!this._layer)
            return;

        // A surface shown for the first time is not laid out yet (no
        // position): the layer follows with the next frame, while the
        // surface's open animation is still transparent
        const top = topLevel(this._surface);
        const [stageX, stageY] = this._surface.get_transformed_position().map(Math.round);
        const [width, height] = this._surface.get_transformed_size().map(Math.round);
        if (!top || [stageX, stageY, width, height].some(Number.isNaN)) {
            this._layer.hide();
            return;
        }

        // Directly below the top-level actor, which menus raise on opening
        const parent = top.get_parent();
        if (this._layer.get_parent() !== parent) {
            this._layer.get_parent()?.remove_child(this._layer);
            parent.insert_child_below(this._layer, top);
        } else if (this._layer.get_next_sibling() !== top) {
            parent.set_child_below_sibling(this._layer, top);
        }

        // Only touch the layer when something changed: setting even equal
        // values could queue a relayout, and with it another frame, forever
        const radius = this._surface.get_theme_node().get_border_radius(St.Corner.TOPLEFT);
        const opacity = this._surface.get_paint_opacity();
        const geometry = `${stageX},${stageY},${width}x${height},${opacity},${radius},${this._backdrop?.path}`;
        if (geometry !== this._geometry) {
            this._geometry = geometry;
            const [, x, y] = parent.transform_stage_point(stageX, stageY);
            this._layer.set_position(Math.round(x), Math.round(y));
            this._layer.set_size(width, height);
            this._layer.opacity = opacity;
            this._rect = [stageX, stageY, width, height];
            this._cull();
            if (!this._live)
                this._layer.style = this._backdropStyle(stageX, stageY, width, height, radius);
            // The wallpaper and windows, lined up with where they are on screen
            for (const clone of this._clones) {
                const [sourceX, sourceY] = clone.source.get_transformed_position();
                clone.set_position(Math.round(sourceX) - stageX, Math.round(sourceY) - stageY);
                clone.set_size(...clone.source.get_size());
            }
        }

        const shape = `${width}x${height}:${radius}`;
        if (this._live && shape !== this._shape) {
            this._shape = shape;
            this._mask.setShape(width, height, radius);
        }

        if (!this._layer.visible)
            this._layer.show();
    }

    // The part of the frosted wallpaper behind the surface, on the monitor
    // it is on, rounded like it
    _backdropStyle(x, y, width, height, radius) {
        const path = this._backdrop?.path;
        const cx = x + width / 2, cy = y + height / 2;
        const monitor = Main.layoutManager.monitors.find(m =>
            cx >= m.x && cx < m.x + m.width && cy >= m.y && cy < m.y + m.height) ??
            Main.layoutManager.primaryMonitor;
        if (!path || !monitor)
            return `border-radius: ${radius}px;`;
        return `background-image: url("${path}");` +
            ` background-size: ${monitor.width}px ${monitor.height}px;` +
            ` background-position: ${monitor.x - x}px ${monitor.y - y}px;` +
            ` border-radius: ${radius}px;`;
    }

    // From the theme: {radius, brightness}; only the live blur has one
    setBlur({radius, brightness}) {
        if (!this._blur)
            return;
        this._blur.radius = radius;
        this._blur.brightness = brightness;
    }

    destroy() {
        global.stage.disconnectObject(this);
        global.window_group.disconnectObject(this);
        global.display.disconnectObject(this);
        this._clear();
        this._surface.disconnectObject(this);
        this._surface.remove_style_class_name('bzd-glass-surface');
        this._layer?.destroy();
    }
}

// What the window group shows, in stacking order; the background group is
// a 0x0 container like the window group, so its monitors' wallpapers count
function sceneParts(group, parts) {
    for (const child of group.get_children()) {
        if (child instanceof Meta.BackgroundGroup)
            sceneParts(child, parts);
        else
            parts.push(child);
    }
    return parts;
}

// The surface's ancestor that sits directly in the UI root. For dialogs that
// is the whole dialog group: inside it the layer would get no size, since the
// group is 0x0 and its layout shrinks anything without its own constraints.
function topLevel(actor) {
    for (let a = actor; a; a = a.get_parent()) {
        if (a.get_parent() === Main.uiGroup)
            return a;
    }
    return null;
}
