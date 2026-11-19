import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {RoundedMaskEffect} from './liveGlass.js';

const WINDOW_TYPES = [Meta.WindowType.NORMAL, Meta.WindowType.DIALOG, Meta.WindowType.MODAL_DIALOG];
// What can show behind glass: real windows and the desktop icons, not the
// short-lived menus, tooltips and popups that come and go all the time
const BEHIND_TYPES = [...WINDOW_TYPES, Meta.WindowType.UTILITY, Meta.WindowType.DESKTOP];
// Corner radius of libadwaita windows (--window-radius); maximized ones have
// square corners
const WINDOW_RADIUS = 15;
// The glass stays this far inside the window's edge, with a concentric
// radius: right at the edge its smoothed rim showed as a fine arc around
// the window's own smoothed, partly transparent corners
const INSET = 1;
// Name of the BackgroundKeyEffect on a window's content
const KEY_EFFECT = 'bzd-glass-background';

const KEY_DECLARATIONS = `
uniform float opacity;
uniform float sidebar;
uniform float dark;
`;
// Colors are premultiplied. A neutral (hueless), opaque pixel in the app's
// background tones (Yaru: up to the sidebar's and header bar's #393939 in
// the dark style, down to #ebebed in the light one) becomes see-through;
// the further a pixel stands out from them (text, symbolic icons), the more
// opaque it stays, fully from a bit beyond, so anti-aliased edges fade
// smoothly from glass to solid instead of leaving see-through specks in
// the letters. The sidebar's tone gets `sidebar` instead of `opacity`, so
// the sidebar is set apart from the content next to it, as on macOS.
// Colored pixels, shadows and soft edges stay as they are.
const KEY_CODE = `
if (cogl_color_out.a > 0.0) {
    vec3 rgb = cogl_color_out.rgb / cogl_color_out.a;
    float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    float solid = dark > 0.5 ? smoothstep(0.25, 0.42, lum) : 1.0 - smoothstep(0.68, 0.85, lum);
    float side = dark > 0.5 ? smoothstep(0.195, 0.215, lum) : 1.0 - smoothstep(0.93, 0.94, lum);
    float alpha = mix(mix(opacity, sidebar, side), 1.0, solid);
    vec4 keyed = vec4(rgb * alpha, alpha);
    float hue = max(max(rgb.r, rgb.g), rgb.b) - min(min(rgb.r, rgb.g), rgb.b);
    float weight = (1.0 - smoothstep(0.04, 0.10, hue)) * smoothstep(0.9, 1.0, cogl_color_out.a);
    cogl_color_out = mix(cogl_color_out, keyed, weight);
}
`;

/**
 * Makes only the plain background of a window see-through, like Mica on
 * Windows or the vibrancy on macOS: the app's own neutral background colors
 * get `opacity` (the sidebar's `sidebar`), while text, icons, accent colors
 * and pictures stay fully opaque. GNOME's apps all draw their backgrounds
 * in such colors.
 */
const BackgroundKeyEffect = GObject.registerClass(
class BackgroundKeyEffect extends Shell.GLSLEffect {
    _init() {
        super._init();
        this._opacityLocation = this.get_uniform_location('opacity');
        this._sidebarLocation = this.get_uniform_location('sidebar');
        this._darkLocation = this.get_uniform_location('dark');
        this._key = '';
    }

    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, KEY_DECLARATIONS, KEY_CODE, false);
    }

    // dark: whether the app draws in the dark style
    setKey(opacity, sidebar, dark) {
        const key = `${opacity}:${sidebar}:${dark}`;
        if (key === this._key)
            return;
        this._key = key;
        this.set_uniform_float(this._opacityLocation, 1, [opacity]);
        this.set_uniform_float(this._sidebarLocation, 1, [sidebar]);
        this.set_uniform_float(this._darkLocation, 1, [dark ? 1 : 0]);
        this.queue_repaint();
    }
});

/**
 * Glass for app windows ('window-glass'). Apps paint opaque backgrounds the
 * shell can't change, so each window gets glass behind it and only its
 * plain background is made see-through ('window-glass-opacity', times the
 * theme's `windowOpacity`), see BackgroundKeyEffect. Behind it lies the static GlassBackdrop and, live blurred over it, only
 * the windows lower in the stack that overlap it. With no window behind,
 * nothing is blurred live at all; otherwise the blur is only redone when
 * something behind changes. Only GNOME's own plain apps get glass, see
 * isGlassApp(): apps with their own design would look wrong, and a
 * translucent window makes everything below it be drawn too. Fullscreen
 * windows (videos, games) stay as they are. Everything is undone on
 * destroy().
 */
export class WindowGlass {
    // live: whether windows behind are blurred live ('glass-live'); tints:
    // {dark, light}, the material over what is behind, per app style
    constructor(settings, backdrop, blur, opacityScale = 1, live = false, tints = null) {
        this._settings = settings;
        this._backdrop = backdrop;
        this._blur = blur;
        this._opacityScale = opacityScale;
        this._live = live;
        this._tints = tints;
        this._watched = new Set(); // every Meta.WindowActor
        this._layers = new Map(); // Meta.WindowActor -> WindowGlassLayer
        this._later = 0;

        for (const actor of global.get_window_actors())
            this._add(actor);
        global.window_group.connectObject(
            'child-added', (_g, actor) => {
                if (actor instanceof Meta.WindowActor)
                    this._add(actor);
            },
            'child-removed', () => this._queueSyncBehind(),
            this);
        global.display.connectObject('restacked', () => this._queueSyncBehind(), this);
        const syncAll = () => {
            for (const layer of this._layers.values())
                layer.sync();
        };
        settings.connectObject('changed::window-glass-opacity', syncAll, this);
        // Apps follow the system's style, and so does what counts as their
        // background
        St.Settings.get().connectObject('notify::color-scheme', syncAll, this);
        this._queueSyncBehind();
    }

    // From the theme: {radius, brightness}
    setBlur(blur) {
        this._blur = blur;
        for (const layer of this._layers.values())
            layer.setBlur(blur);
    }

    // The windows of BEHIND_TYPES count for what lies behind the others,
    // but only those of WINDOW_TYPES get glass themselves
    _add(actor) {
        const window = actor.meta_window;
        if (!window || this._watched.has(actor) || !BEHIND_TYPES.includes(window.get_window_type()))
            return;

        this._watched.add(actor);
        window.connectObject(
            'position-changed', () => this._queueSyncBehind(),
            'size-changed', () => this._queueSyncBehind(),
            this);
        actor.connectObject('destroy', () => this._remove(actor), this);
        if (WINDOW_TYPES.includes(window.get_window_type())) {
            const layer = new WindowGlassLayer(actor, this._backdrop, () => this._opacity(),
                () => this._queueSyncBehind(), this._tints);
            layer.setBlur(this._blur);
            this._layers.set(actor, layer);
        }
        this._queueSyncBehind();
    }

    // The content's and the sidebar's: squared, the sidebar is clearer,
    // the more so the clearer the content, and opaque only along with it
    _opacity() {
        const content = this._settings.get_int('window-glass-opacity') / 100 * this._opacityScale;
        return {content, sidebar: content ** 2};
    }

    _remove(actor) {
        this._watched.delete(actor);
        actor.disconnectObject(this);
        actor.meta_window?.disconnectObject(this);
        this._layers.get(actor)?.destroy();
        this._layers.delete(actor);
    }

    // Once before the next frame, however many windows moved
    _queueSyncBehind() {
        if (this._later)
            return;
        this._later = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._later = 0;
            this._syncBehind();
            return GLib.SOURCE_REMOVE;
        });
    }

    _syncBehind() {
        if (!this._live)
            return;
        const actors = global.get_window_actors() // bottom to top
            .filter(actor => this._watched.has(actor));
        for (const [actor, layer] of this._layers) {
            const frame = actor.meta_window.get_frame_rect();
            const below = actors.slice(0, Math.max(0, actors.indexOf(actor)))
                .filter(other => !other.meta_window?.minimized &&
                    overlaps(frame, other.meta_window.get_frame_rect()));
            layer.setBehind(below);
        }
    }

    destroy() {
        if (this._later)
            global.compositor.get_laters().remove(this._later);
        this._later = 0;
        global.window_group.disconnectObject(this);
        global.display.disconnectObject(this);
        this._settings.disconnectObject(this);
        St.Settings.get().disconnectObject(this);
        for (const actor of [...this._watched])
            this._remove(actor);
    }
}

/**
 * The glass behind one window. It is a child of the window actor, below
 * the window's content, so it moves, animates, minimizes and changes
 * workspace together with the window by itself. Inside, the whole
 * monitor's frosted wallpaper is shifted so that the part behind the
 * window shows; moving the window only moves that image. Over it, clones
 * of the windows behind (setBehind()) are blurred live, only while there
 * are any.
 */
class WindowGlassLayer {
    // opacity() gives {content, sidebar}; onGlassChanged is called when the
    // window gets or loses its glass; tints: {dark, light}, a layer of the
    // app's style over what is behind, so a bright window behind a dark app
    // doesn't wash it out
    constructor(actor, backdrop, opacity, onGlassChanged, tints = null) {
        this._actor = actor;
        this._window = actor.meta_window;
        this._backdrop = backdrop;
        this._opacity = opacity;
        this._onGlassChanged = onGlassChanged;
        this._shape = '';
        this._imageStyle = '';

        this._image = new St.Widget();
        // Clipped, so the blur only covers the window's own area
        this._behind = new St.Widget({clip_to_allocation: true, visible: false});
        this._blur = new Shell.BlurEffect({mode: Shell.BlurMode.ACTOR});
        this._behind.add_effect(this._blur);
        this._clones = [];
        this._bindings = new Map(); // clone -> binding of its visibility
        this._mask = new RoundedMaskEffect();
        this._tints = tints;
        this._tint = new St.Widget();
        this._tintStyle = '';
        this._layer = new St.Widget({clip_to_allocation: true});
        this._layer.add_child(this._image);
        this._layer.add_child(this._behind);
        this._layer.add_child(this._tint);
        this._layer.add_effect(this._mask);
        this._layer.connect('destroy', () => (this._layer = null));
        actor.insert_child_at_index(this._layer, 0);

        this._window.connectObject(
            'position-changed', () => this.sync(),
            'size-changed', () => this.sync(),
            'notify::fullscreen', () => this.sync(),
            // GTK may only tell its app after the window appears
            'notify::gtk-application-id', () => this.sync(),
            'notify::skip-taskbar', () => this.sync(),
            'notify::maximized-horizontally', () => this.sync(),
            'notify::maximized-vertically', () => this.sync(),
            this);
        backdrop.connectObject('changed', () => this.sync(), this);
        // The window's content may come only after the window actor
        actor.connectObject('child-added', () => this.sync(), this);
        this.sync();
    }

    // The window's own children, without our layer
    _contents() {
        return this._actor.get_children().filter(child => child !== this._layer);
    }

    // With an effect, Mutter no longer takes the content as opaque, so it
    // draws the glass below it. Without glass (fullscreen) the effect goes
    // entirely, not just disabled: Mutter counts disabled effects too, and
    // a fullscreen window with one can't go to the display directly, but is
    // composited every frame, which costs much more power with videos
    _syncContents(glass) {
        const {content, sidebar} = this._opacity();
        const dark = St.Settings.get().color_scheme === St.SystemColorScheme.PREFER_DARK;
        for (const child of this._contents()) {
            let effect = child.get_effect(KEY_EFFECT);
            if (!glass) {
                if (effect)
                    child.remove_effect(effect);
                continue;
            }
            if (!effect) {
                effect = new BackgroundKeyEffect();
                child.add_effect_with_name(KEY_EFFECT, effect);
            }
            effect.setKey(content, sidebar, dark);
        }
    }

    sync() {
        if (!this._layer)
            return;

        const {path} = this._backdrop;
        const monitor = Main.layoutManager.monitors[this._window.get_monitor()];
        const glass = Boolean(path && monitor && !this._window.fullscreen && isGlassApp(this._window));
        this._syncContents(glass);
        if (this._layer.visible !== Boolean(glass)) {
            this._layer.visible = Boolean(glass);
            this._onGlassChanged();
        }
        if (!glass)
            return;

        // The actor spans the buffer, which includes client-side shadows;
        // the glass only goes behind the visible frame, a bit inside it if
        // the window has round corners
        const maximized = this._window.maximized_horizontally && this._window.maximized_vertically;
        const inset = maximized ? 0 : INSET;
        const radius = maximized ? 0 : WINDOW_RADIUS - INSET;
        const frame = this._window.get_frame_rect();
        const buffer = this._window.get_buffer_rect();
        const width = frame.width - 2 * inset;
        const height = frame.height - 2 * inset;
        this._layer.set_position(frame.x - buffer.x + inset, frame.y - buffer.y + inset);
        this._layer.set_size(width, height);
        this._behind.set_size(width, height);
        this._tint.set_size(width, height);
        const dark = St.Settings.get().color_scheme === St.SystemColorScheme.PREFER_DARK;
        const tint = this._tints ? `background-color: ${dark ? this._tints.dark : this._tints.light};` : '';
        if (tint !== this._tintStyle) {
            this._tintStyle = tint;
            this._tint.style = tint;
        }
        this._placeClones();

        const imageStyle = `background-image: url("${path}");` +
            ` background-size: ${monitor.width}px ${monitor.height}px;`;
        if (imageStyle !== this._imageStyle) {
            this._imageStyle = imageStyle;
            this._image.style = imageStyle;
            this._image.set_size(monitor.width, monitor.height);
        }
        this._image.set_position(monitor.x - frame.x - inset, monitor.y - frame.y - inset);

        const shape = `${width}x${height}:${radius}`;
        if (shape !== this._shape) {
            this._shape = shape;
            this._mask.setShape(width, height, radius);
        }
    }

    // From the theme: {radius, brightness}
    setBlur(blur) {
        if (!blur)
            return;
        this._blur.radius = blur.radius;
        this._blur.brightness = blur.brightness;
    }

    // The windows behind this one that overlap it, bottom to top. Clones of
    // windows still behind are kept: making them anew would redo the blur
    // from scratch and flicker.
    setBehind(actors) {
        if (!this._layer)
            return;
        if (!this._layer.visible)
            actors = [];

        const kept = new Map(this._clones.map(clone => [clone.source, clone]));
        this._clones = actors.map(source => {
            let clone = kept.get(source);
            kept.delete(source);
            if (!clone) {
                clone = new Clutter.Clone({source});
                // Hidden with their window: minimized or on another workspace
                this._bindings.set(clone,
                    source.bind_property('visible', clone, 'visible', GObject.BindingFlags.SYNC_CREATE));
                this._behind.add_child(clone);
            }
            return clone;
        });
        for (const clone of kept.values())
            this._destroyClone(clone);
        // In stacking order, without touching clones already in place
        this._clones.forEach((clone, i) => {
            if (this._behind.get_child_at_index(i) !== clone)
                this._behind.set_child_at_index(clone, i);
        });
        this._behind.visible = this._clones.length > 0;
        this._placeClones();
    }

    _destroyClone(clone) {
        this._bindings.get(clone)?.unbind();
        this._bindings.delete(clone);
        clone.destroy();
    }

    // Each clone where its window is, seen from this window's glass
    _placeClones() {
        if (!this._clones.length)
            return;
        const frame = this._window.get_frame_rect();
        const maximized = this._window.maximized_horizontally && this._window.maximized_vertically;
        const inset = maximized ? 0 : INSET;
        for (const clone of this._clones) {
            const x = clone.source.x - frame.x - inset;
            const y = clone.source.y - frame.y - inset;
            if (clone.x !== x || clone.y !== y)
                clone.set_position(x, y);
        }
    }

    destroy() {
        this._window.disconnectObject(this);
        this._backdrop.disconnectObject(this);
        this._actor.disconnectObject(this);
        for (const clone of this._clones)
            this._destroyClone(clone);
        this._clones = [];
        for (const child of this._contents())
            child.remove_effect_by_name(KEY_EFFECT);
        this._layer?.destroy();
        this._layer = null;
    }
}

// GNOME's own apps (Files, Settings, Text Editor, Calculator …), which use
// the plain system look: GTK tells their app ID, all starting with
// "org.gnome.". Apps with their own design (browsers, Spotify, Discord,
// editors, games), the desktop icons and anything kept out of the window
// list stay untouched.
function isGlassApp(window) {
    return !window.is_skip_taskbar() &&
        Boolean(window.get_gtk_application_id()?.startsWith('org.gnome.'));
}

function overlaps(a, b) {
    return a.x < b.x + b.width && b.x < a.x + a.width &&
        a.y < b.y + b.height && b.y < a.y + a.height;
}
