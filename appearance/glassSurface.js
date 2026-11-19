import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Puts the GlassBackdrop behind one actor, cut out exactly where the actor
 * sits on its monitor, so it looks like frosted glass over the wallpaper.
 * Used for the docks, which nothing moves behind. Only updated when the
 * actor or one of its ancestors is laid out anew, never per frame.
 * The actor's own inline style is kept and restored on destroy(); the
 * bzd-glass-surface class gives it the rim from the stylesheet.
 */
export class GlassSurface {
    constructor(actor, backdrop) {
        this._actor = actor;
        this._backdrop = backdrop;
        this._original = actor.style ?? '';
        this._later = 0;
        actor.add_style_class_name('bzd-glass-surface');

        // The actor moves whenever one of its ancestors does
        this._ancestors = [];
        for (let a = actor; a && a !== global.stage; a = a.get_parent()) {
            a.connectObject('notify::allocation', () => this._queueSync(), this);
            this._ancestors.push(a);
        }
        actor.connectObject('destroy', () => (this._actor = null), this);
        backdrop.connectObject('changed', () => this._queueSync(), this);
        this._queueSync();
    }

    // Once before the next frame, outside of the layout pass
    _queueSync() {
        if (this._later)
            return;
        this._later = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._later = 0;
            this._sync();
            return GLib.SOURCE_REMOVE;
        });
    }

    // Ubuntu Dock goes on the stage only once the shell has started; its
    // first layout there syncs again
    _sync() {
        if (!this._actor?.get_stage())
            return;

        const {path} = this._backdrop;
        const monitor = Main.layoutManager.findMonitorForActor(this._actor) ??
            Main.layoutManager.primaryMonitor;
        let style = this._original;
        if (path && monitor) {
            // Whole pixels: tiny floats would print as 1e-7, which CSS can't read
            const [x, y] = stagePosition(this._actor).map(Math.round);
            style += ` background-image: url("${path}");` +
                ` background-size: ${monitor.width}px ${monitor.height}px;` +
                ` background-position: ${monitor.x - x}px ${monitor.y - y}px;`;
        }
        if ((this._actor.style ?? '') !== style)
            this._actor.style = style;
    }

    destroy() {
        if (this._later)
            global.compositor.get_laters().remove(this._later);
        this._later = 0;
        for (const actor of this._ancestors)
            actor.disconnectObject(this);
        this._backdrop.disconnectObject(this);
        if (this._actor) {
            this._actor.remove_style_class_name('bzd-glass-surface');
            this._actor.style = this._original || null;
        }
        this._actor = null;
    }
}

/**
 * Glass for one dock. The dock sets inline styles on its own background,
 * so the glass goes on a layer of ours inside it instead, below the icons:
 * the frosted wallpaper, and over it the tint, rim and shine
 * (.bzd-glass-tint), which the opaque image would otherwise hide.
 */
export class DockGlassLayer {
    constructor(dash, backdrop) {
        const background = dash._background;
        this._layer = new St.Widget({style_class: 'bzd-glass-layer', layout_manager: new Clutter.BinLayout()});
        this._layer.add_constraint(new Clutter.BindConstraint({
            source: background,
            coordinate: Clutter.BindCoordinate.SIZE,
        }));
        this._layer.add_child(new St.Widget({style_class: 'bzd-glass-tint', x_expand: true, y_expand: true}));
        this._layer.connectObject('destroy', () => (this._layer = null), this);
        background.insert_child_at_index(this._layer, 0);
        this._surface = new GlassSurface(this._layer, backdrop);
    }

    destroy() {
        this._surface.destroy();
        this._layer?.destroy();
        this._layer = null;
    }
}

// Position on the stage from the allocations alone: unlike the transformed
// position it ignores running open/close animations
function stagePosition(actor) {
    let x = 0, y = 0;
    for (let a = actor; a && a !== global.stage; a = a.get_parent()) {
        const box = a.get_allocation_box();
        x += box.x1;
        y += box.y1;
    }
    return [x, y];
}
