import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import St from 'gi://St';

// The big grid keeps this share of the icon size along the dock: its
// symbol has room of its own around it, so its tile can be shorter than
// square
const GRID_SHARE = 0.75;
// The pills at the dock's end (tray button, status pills, clock, see
// stylesheet.css .bzd-dock-pill): as wide as the icon size plus 2 px
// padding and a 1 px rim on either side, single-line ones 28 px high (26 px
// inside the rim); the symbol on them as big as fits
const PILL_EXTRA = 6;
const PILL_HEIGHT = 28;
const PILL_SYMBOL = 20;

/**
 * The look of one dash's "Show Applications" button: the 'show-apps-icon'
 * setting (an icon name or image path) as its image, and with
 * 'show-apps-style' either the grid on a pill the size of the others at
 * the dock's end ('pill'), the big grid in a tile shorter than square, so
 * it doesn't stand off from what is around it ('grid'), or three dots on
 * such a pill ('thin'). The pill shows with 'clock-pill', like the clock's
 * ('bzd-dock-pill'); without, the button keeps its size. Nothing of the
 * dock is patched: the dock builds its icon as usual and only the image and
 * the button's size are changed, also each time the dock rebuilds it.
 * Everything goes back on destroy().
 */
export class ShowAppsIcon {
    constructor(dash, settings, dockModules) {
        this._dash = dash;
        this._baseIcon = dash._showAppsIcon?.icon;
        this._button = dash._showAppsIcon?.toggleButton ?? this._baseIcon?.get_parent() ?? null;
        this._settings = settings;
        const side = dockModules?.Utils?.getPosition?.() ?? St.Side.LEFT;
        this._vertical = side === St.Side.LEFT || side === St.Side.RIGHT;
        if (!this._baseIcon)
            return;

        // As wide as the dock across, like the app icons' tiles: the dock
        // puts the hover label right behind the item, which would otherwise
        // be under the dock's edge (the button inside stays centered)
        this._container = dash._showAppsIcon;
        this._containerAlign = [this._container.x_align, this._container.y_align];
        if (this._vertical)
            this._container.x_align = Clutter.ActorAlign.FILL;
        else
            this._container.y_align = Clutter.ActorAlign.FILL;

        // The symbol in the middle of the tile also when it is smaller than
        // the tile (on a pill): the icon's box would put it at the top. The
        // box is centered, not expanded, as expanding would spread to the
        // button and widen it
        this._box = this._baseIcon._iconBin.get_parent();
        this._boxAlign = this._box?.y_align;
        if (this._box)
            this._box.y_align = Clutter.ActorAlign.CENTER;

        this._baseIcon._iconBin.connectObject('notify::child', () => this._apply(), this);
        // Gone together with its dock, nothing left to restore then
        this._baseIcon.connectObject('destroy', () => (this._baseIcon = null), this);
        settings.connectObject(
            'changed::show-apps-icon', () => this._rebuild(),
            'changed::show-apps-style', () => this._rebuild(),
            'changed::clock-pill', () => this._apply(),
            this);
        dash.connectObject('icon-size-changed', () => this._apply(), this);
        this._apply();
    }

    _style() {
        return this._settings.get_string('show-apps-style');
    }

    _thin() {
        return this._style() === 'thin';
    }

    _gicon() {
        if (this._thin())
            return new Gio.ThemedIcon({name: this._vertical ? 'view-more-horizontal-symbolic' : 'view-more-symbolic'});
        const value = this._settings.get_string('show-apps-icon').trim();
        if (!value)
            return null;
        try {
            return Gio.Icon.new_for_string(value);
        } catch (e) {
            console.warn(`Dock Media: invalid show-apps icon "${value}": ${e.message}`);
            return null;
        }
    }

    _apply() {
        if (!this._baseIcon)
            return;
        const onPill = this._style() !== 'grid';
        const gicon = this._gicon();
        const image = this._baseIcon.icon;
        const size = this._dash.iconSize;
        if (image) {
            if (gicon)
                image.gicon = gicon;
            // Drawn as big as the tile has room for: at the dock's icon size
            // it would be taller than the tile, shrunk to fit and pushed
            // down by the overflow, so it looked cut off at the bottom
            image.icon_size = onPill ? PILL_SYMBOL : Math.round(size * GRID_SHARE);
            // In full size in the middle: filling the shorter box, St would
            // shrink the symbol with it
            image.set({x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER});
        }

        // Along the dock (its height in a side dock) as high as the other
        // pills or shorter than square, across as wide as the pills or an
        // icon; both fixed, as the icon is a square bin otherwise
        const along = onPill ? PILL_HEIGHT : Math.round(size * GRID_SHARE);
        const across = onPill ? size + PILL_EXTRA : size;
        if (this._vertical)
            this._baseIcon.set_size(across, along);
        else
            this._baseIcon.set_size(along, across);

        const pill = onPill && this._settings.get_boolean('clock-pill');
        if (pill)
            this._button?.add_style_class_name('bzd-dock-pill');
        else
            this._button?.remove_style_class_name('bzd-dock-pill');
    }

    // Let the dock create its original icon again; notify::child then puts
    // the custom image on it, if any
    _rebuild() {
        this._baseIcon?._createIconTexture(this._baseIcon.iconSize);
        this._apply();
    }

    destroy() {
        this._settings.disconnectObject(this);
        this._dash?.disconnectObject(this);
        if (!this._baseIcon)
            return;

        this._baseIcon._iconBin.disconnectObject(this);
        if (this._box)
            this._box.y_align = this._boxAlign;
        this._baseIcon.disconnectObject(this);
        this._baseIcon.set_size(-1, -1);
        [this._container.x_align, this._container.y_align] = this._containerAlign;
        this._button?.remove_style_class_name('bzd-dock-pill');
        this._baseIcon._createIconTexture(this._baseIcon.iconSize);
        this._baseIcon = null;
        this._dash = null;
    }
}
