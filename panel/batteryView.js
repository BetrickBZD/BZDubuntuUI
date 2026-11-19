import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// At or below this charge the battery shows as low
const LOW_PERCENT = 20;
// UPower's DeviceState.CHARGING
const CHARGING = 1;

/**
 * The battery as a small line: GNOME's own battery icon and, when GNOME is
 * set to show it, the percentage, like in the top bar. Bound to the quick
 * settings' power toggle, which GNOME keeps up to date anyway, so it costs
 * nothing extra. Shown only while `enabled` and there is a battery. With
 * `colored` it is green while charging and red when low
 * (bzd-battery-charging, bzd-battery-low), read from the toggle's UPower
 * device.
 */
export const BatteryView = GObject.registerClass(
class BatteryView extends St.BoxLayout {
    _init(params) {
        super._init({
            style_class: 'bzd-battery',
            x_align: Clutter.ActorAlign.CENTER,
            visible: false,
            ...params,
        });
        this._enabled = true;
        this._colored = true;
        this._toggle = null;

        this._icon = new St.Icon({style_class: 'bzd-battery-icon', y_align: Clutter.ActorAlign.CENTER});
        this._percentage = new St.Label({style_class: 'bzd-battery-percentage', y_align: Clutter.ActorAlign.CENTER});
        this.add_child(this._icon);
        this.add_child(this._percentage);

        this._interfaceSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        this._interfaceSettings.connectObject('changed::show-battery-percentage', () => this._sync(), this);
        this.connect('destroy', () => {
            this._toggle?.disconnectObject(this);
            this._interfaceSettings.disconnectObject(this);
        });
        this._findToggle();
    }

    set enabled(enabled) {
        this._enabled = enabled;
        this._sync();
    }

    set colored(colored) {
        this._colored = colored;
        this._sync();
    }

    // The quick settings build their indicators asynchronously, so at login
    // the power toggle may come only after this view
    _findToggle() {
        const quickSettings = Main.panel.statusArea.quickSettings;
        this._toggle = quickSettings?._system?._systemItem?.powerToggle ?? null;
        if (!this._toggle) {
            quickSettings?._indicators?.connectObject('child-added', () => {
                quickSettings._indicators.disconnectObject(this);
                this._findToggle();
            }, this);
            return;
        }

        this._toggle.connectObject(
            'notify::visible', () => this._sync(),
            'notify::gicon', () => this._sync(),
            'notify::fallback-icon-name', () => this._sync(),
            'notify::title', () => this._sync(),
            this);
        this._sync();
    }

    _sync() {
        const toggle = this._toggle;
        // The toggle is visible exactly when there is a battery (or a UPS)
        this.visible = this._enabled && Boolean(toggle?.visible);
        if (!this.visible)
            return;

        this._icon.set({gicon: toggle.gicon, fallback_icon_name: toggle.fallback_icon_name});
        this._percentage.text = toggle.title ?? '';
        this._percentage.visible = this._interfaceSettings.get_boolean('show-battery-percentage');

        const device = toggle._proxy;
        const charging = this._colored && device?.State === CHARGING;
        const low = this._colored && !charging && typeof device?.Percentage === 'number' &&
            device.Percentage <= LOW_PERCENT;
        setClass(this, 'bzd-battery-charging', charging);
        setClass(this, 'bzd-battery-low', low);
    }
});

function setClass(actor, name, on) {
    if (on)
        actor.add_style_class_name(name);
    else
        actor.remove_style_class_name(name);
}
