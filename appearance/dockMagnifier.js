import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const DURATION = 150; // ms, back to normal size
// Leaving one icon for the next reports the pointer gone for a moment:
// only shrink back if it stays gone this long
const LEAVE_DELAY = 80; // ms

/**
 * Magnifies the app icons of one dash around the pointer, like the macOS
 * dock: the icon under it grows most ('dock-magnify-zoom', in %), its
 * neighbors less, up to 'dock-magnify-range' icons away. Icons grow away
 * from the screen edge the dock sits at.
 *
 * The dock clips its icons to its own width, so a grown icon's image is
 * drawn as a clone on a layer of ours right above the dock, together with
 * its notification badge, while the originals are hidden; only the image
 * and badge, not the tile around them. Like on
 * macOS the dock's grey hover tile is off meanwhile (bzd-magnify), and the
 * icons' hover labels move out by as much as the icon grew.
 * Clutter only sends pointer events to reactive actors, so they come from
 * the icons' own buttons. Nothing runs while the pointer is not on an
 * icon; leaving the icons eases them back and drops the clones. Follows
 * apps being added to and removed from the dock.
 */
export class DockMagnifier {
    constructor(dash, dockModules, settings) {
        this._dash = dash;
        this._box = dash._box;
        this._settings = settings;
        // dash item -> {button, icon (BaseIcon), clone (group), image and
        // badge (the hidden originals), badgeClone}
        this._tracked = new Map();
        this._leaveId = 0;
        this._layer = null;
        if (!this._box)
            return;
        dash.add_style_class_name('bzd-magnify');
        // The dock may destroy its dash before us (screen lock, dock
        // rebuilt): then there is nothing of it left to restore
        dash.connectObject('destroy', () => {
            this._dash = null;
            this._box = null;
            this._tracked.clear();
        }, this);

        const side = dockModules?.Utils?.getPosition?.() ?? St.Side.LEFT;
        this._vertical = side === St.Side.LEFT || side === St.Side.RIGHT;
        this._pivot = {
            [St.Side.LEFT]: [0, 0.5],
            [St.Side.RIGHT]: [1, 0.5],
            [St.Side.TOP]: [0.5, 0],
            [St.Side.BOTTOM]: [0.5, 1],
        }[side] ?? [0.5, 0.5];
        // Which way a hover label moves out, per px an icon grew
        this._labelShift = {
            [St.Side.LEFT]: [1, 0],
            [St.Side.RIGHT]: [-1, 0],
            [St.Side.TOP]: [0, 1],
            [St.Side.BOTTOM]: [0, -1],
        }[side] ?? [0, 0];

        this._box.connectObject(
            'child-added', (_b, item) => this._track(item),
            'child-removed', (_b, item) => this._untrack(item),
            this);
        settings.connectObject(
            'changed::dock-magnify-zoom', () => this._readSettings(),
            'changed::dock-magnify-range', () => this._readSettings(),
            this);
        this._readSettings();
        for (const item of this._box.get_children())
            this._track(item);
    }

    _readSettings() {
        this._zoom = this._settings.get_int('dock-magnify-zoom') / 100;
        this._range = this._settings.get_int('dock-magnify-range');
    }

    // Only app icons: their button carries the icon (a BaseIcon) to scale
    _track(item) {
        const button = item.child;
        const icon = button?.icon;
        if (!icon || this._tracked.has(item))
            return;

        button.connectObject(
            'motion-event', (_b, event) => this._magnify(event),
            'notify::hover', () => this._queueLeave(),
            this);
        // The dock often destroys an icon before reporting it removed
        icon.connectObject('destroy', () => this._untrack(item, false), this);
        this._tracked.set(item, {button, icon, clone: null, image: null, badge: null, badgeClone: null, bindings: null});
    }

    _untrack(item, alive = true) {
        const tracked = this._tracked.get(item);
        if (!tracked)
            return;

        this._tracked.delete(item);
        dropClone(tracked);
        if (!alive)
            return;
        tracked.button.disconnectObject(this);
        tracked.icon.disconnectObject(this);
        showImage(tracked);
        setLabelShift(item, 0, 0);
    }

    // Right above the dock's top-level actor, so the clones are drawn over
    // the dock but under menus and the dock's labels added later
    _ensureLayer() {
        if (this._layer)
            return this._layer;
        let top = this._dash;
        while (top.get_parent() && top.get_parent() !== Main.uiGroup)
            top = top.get_parent();
        this._layer = new Clutter.Actor({reactive: false});
        if (top.get_parent() === Main.uiGroup)
            Main.uiGroup.insert_child_above(this._layer, top);
        else
            Main.uiGroup.add_child(this._layer);
        this._layer.connect('destroy', () => (this._layer = null));
        return this._layer;
    }

    // Each icon by its distance to the pointer along the dock, in icons:
    // full zoom right under it, none from `range` + 0.5 icons away on
    _magnify(event) {
        this._cancelLeave();
        const [pointerX, pointerY] = event.get_coords();
        const pointer = this._vertical ? pointerY : pointerX;
        for (const [item, tracked] of this._tracked) {
            const [x, y] = item.get_transformed_position();
            const [width, height] = item.get_transformed_size();
            const size = this._vertical ? height : width;
            if (!size)
                continue;
            const center = this._vertical ? y + height / 2 : x + width / 2;
            const distance = Math.abs(pointer - center) / size;
            const reach = Math.max(0, 1 - distance / (this._range + 0.5));
            this._scale(item, tracked, 1 + (this._zoom - 1) * reach * reach);
        }
        return Clutter.EVENT_PROPAGATE;
    }

    // The BaseIcon's image (an St.Icon), which the dock replaces when the
    // icon size or theme changes, and the icon's notification badge, if
    // any: both cloned into one group that grows around the image's pivot,
    // so the badge stays on the icon's corner. A badge coming while the
    // icon is grown joins with the next pointer motion
    _scale(item, tracked, scale) {
        if (scale <= 1.001 && !tracked.clone)
            return;
        const image = tracked.icon.icon;
        if (!image)
            return;

        if (!tracked.clone || tracked.image !== image) {
            dropClone(tracked);
            showImage(tracked);
            tracked.clone = new Clutter.Actor({
                pivot_point: new Graphene.Point({x: this._pivot[0], y: this._pivot[1]}),
            });
            tracked.clone.add_child(new Clutter.Clone({source: image}));
            this._ensureLayer().add_child(tracked.clone);
            // It moves along when the icon does, as when it hops while its
            // app starts (LaunchFeedback)
            tracked.bindings = ['translation-x', 'translation-y'].map(property =>
                tracked.icon.bind_property(property, tracked.clone, property, GObject.BindingFlags.SYNC_CREATE));
            tracked.image = image;
            image.opacity = 0;
        }
        const {clone} = tracked;
        clone.remove_all_transitions();
        // Where the image is now, without the icon's own movement, which
        // the group follows by itself; the dock may have scrolled or moved
        let [x, y] = image.get_transformed_position();
        x -= tracked.icon.translation_x;
        y -= tracked.icon.translation_y;
        const [width, height] = image.get_transformed_size();
        clone.set_position(Math.round(x), Math.round(y));
        clone.set_size(width, height);
        clone.get_first_child().set_size(width, height);
        this._syncBadge(tracked, x, y);
        clone.set_scale(scale, scale);

        const grown = (this._vertical ? width : height) * (scale - 1);
        setLabelShift(item, this._labelShift[0] * grown, this._labelShift[1] * grown);
    }

    // The dock's badge (a bin around the 'notification-badge' label) sits
    // in the icon's container next to the image; a hidden one stays hidden
    _syncBadge(tracked, imageX, imageY) {
        const bin = tracked.button._iconContainer?.get_children()
            .find(child => child.child?.has_style_class_name?.('notification-badge'));
        const shown = bin && bin.child.opacity > 0 ? bin : null;
        if (shown !== tracked.badge) {
            tracked.badgeClone?.destroy();
            tracked.badgeClone = null;
            if (tracked.badge)
                tracked.badge.opacity = 255;
            tracked.badge = shown;
            if (shown) {
                tracked.badgeClone = new Clutter.Clone({source: shown});
                tracked.clone.add_child(tracked.badgeClone);
                shown.opacity = 0;
            }
        }
        if (!shown)
            return;
        const [x, y] = shown.get_transformed_position();
        const [width, height] = shown.get_transformed_size();
        tracked.badgeClone.set_position(Math.round(x - imageX), Math.round(y - imageY));
        tracked.badgeClone.set_size(width, height);
    }

    _queueLeave() {
        if ([...this._tracked.values()].some(({button}) => button.hover))
            return;
        this._cancelLeave();
        this._leaveId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, LEAVE_DELAY, () => {
            this._leaveId = 0;
            this._reset();
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelLeave() {
        if (this._leaveId)
            GLib.source_remove(this._leaveId);
        this._leaveId = 0;
    }

    // Clones shrink back onto their icons, which then show again
    _reset() {
        for (const [item, tracked] of this._tracked) {
            const {clone, bindings} = tracked;
            setLabelShift(item, 0, 0);
            if (!clone)
                continue;
            tracked.clone = null;
            tracked.bindings = null;
            clone.ease({
                scale_x: 1,
                scale_y: 1,
                duration: DURATION,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onStopped: () => {
                    // Not if the pointer came back and made a new clone,
                    // nor if the icon is gone meanwhile (its image with it)
                    if (!tracked.clone && this._tracked.get(item) === tracked)
                        showImage(tracked);
                    bindings?.forEach(binding => binding.unbind());
                    clone.destroy();
                },
            });
        }
    }

    destroy() {
        this._cancelLeave();
        this._settings.disconnectObject(this);
        this._box?.disconnectObject(this);
        for (const item of [...this._tracked.keys()])
            this._untrack(item);
        this._layer?.destroy();
        this._layer = null;
        this._dash?.disconnectObject(this);
        this._dash?.remove_style_class_name('bzd-magnify');
        this._box = null;
        this._dash = null;
    }
}

// The originals show again: the image, and the badge if it is still there
// The grown group goes, with what ties it to its icon
function dropClone(tracked) {
    tracked.bindings?.forEach(binding => binding.unbind());
    tracked.bindings = null;
    tracked.clone?.destroy();
    tracked.clone = null;
}

function showImage(tracked) {
    if (tracked.image)
        tracked.image.opacity = 255;
    tracked.image = null;
    if (tracked.badge?.get_parent())
        tracked.badge.opacity = 255;
    tracked.badge = null;
    tracked.badgeClone = null;
}

function setLabelShift(item, x, y) {
    const {label} = item;
    if (!label || (label.translation_x === x && label.translation_y === y))
        return;
    label.translation_x = x;
    label.translation_y = y;
}
