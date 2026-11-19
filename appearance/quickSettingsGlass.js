import Shell from 'gi://Shell';

const EFFECT = 'bzd-overlay-blur';
// How far GNOME dims the quick settings under an open menu
// (quickSettings.js: DIM_BRIGHTNESS)
const DIM_BRIGHTNESS = -0.4;

/**
 * Blurs what is in the quick settings while one of their menus (power,
 * Wi-Fi, Bluetooth …) lies over them, so the menu is glass over them like
 * any other surface instead of a solid block: the toggles and sliders, and
 * whatever else is in the box, like the notifications and calendar of the
 * unified panel. The box itself, with the glass's tint and rim, stays
 * sharp. It follows GNOME's own dimming, blurring as far as they are
 * dimmed, so it fades in and out with it; nothing runs while no menu is
 * open. The menus themselves get their tint from the theme
 * (.quick-toggle-menu).
 */
export class QuickSettingsGlass {
    constructor(menu, radius) {
        this._box = menu?.box ?? null;
        this._dim = menu?._boxPointer?.get_effect('dim') ?? null;
        this._radius = radius;
        this._blurs = new Map(); // child of the box -> its Shell.BlurEffect
        if (!this._box || !this._dim)
            return;

        // What leaves the box (the unified panel giving back the calendar)
        // leaves without our blur
        this._box.connectObject('child-removed', (_b, child) => this._unblur(child), this);
        this._dim.connectObject(
            'notify::brightness', () => this._sync(),
            'notify::enabled', () => this._sync(),
            this);
        this._sync();
    }

    // The box's children as of now, each blurred once a menu is open
    _sync() {
        const [red] = this._dim.get_brightness();
        const share = this._dim.enabled ? Math.clamp(red / DIM_BRIGHTNESS, 0, 1) : 0;
        const radius = Math.round(this._radius * share);
        if (radius <= 0) {
            for (const blur of this._blurs.values())
                blur.enabled = false;
            return;
        }
        for (const child of this._box.get_children()) {
            let blur = this._blurs.get(child);
            if (!blur) {
                blur = new Shell.BlurEffect({mode: Shell.BlurMode.ACTOR, brightness: 1});
                child.add_effect_with_name(EFFECT, blur);
                this._blurs.set(child, blur);
                child.connectObject('destroy', () => this._blurs.delete(child), this);
            }
            blur.enabled = true;
            if (blur.radius !== radius)
                blur.radius = radius;
        }
    }

    _unblur(child) {
        if (!this._blurs.has(child))
            return;
        this._blurs.delete(child);
        child.disconnectObject(this);
        child.remove_effect_by_name(EFFECT);
    }

    destroy() {
        this._dim?.disconnectObject(this);
        this._box?.disconnectObject(this);
        for (const child of [...this._blurs.keys()])
            this._unblur(child);
        this._box = null;
        this._dim = null;
    }
}
