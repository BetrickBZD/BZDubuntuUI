import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const UPOWER_DEVICE_STATE = {
    CHARGING: 1,
    FULLY_CHARGED: 4,
};

/**
 * What the top bar would otherwise show, as text for the clock's tooltip:
 * date, battery and notifications. Read on demand, nothing is polled.
 */
export class SystemStatus {
    constructor() {
        this._cancellable = new Gio.Cancellable();
        this._battery = null;
        this._notificationSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.notifications'});

        // The proxy keeps its cached properties up to date by itself
        Gio.DBusProxy.new_for_bus(Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, null,
            'org.freedesktop.UPower', '/org/freedesktop/UPower/devices/DisplayDevice',
            'org.freedesktop.UPower.Device', this._cancellable, (_o, result) => {
                try {
                    this._battery = Gio.DBusProxy.new_for_bus_finish(result);
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        console.warn(`Dock Media: no battery info: ${e.message}`);
                }
            });
    }

    describe() {
        return [this._date(), this.batteryText(), this._notificationsText()]
            .filter(Boolean)
            .join('\n');
    }

    _date() {
        return GLib.DateTime.new_now_local().format('%A, %e. %B');
    }

    batteryText() {
        const prop = name => this._battery?.get_cached_property(name)?.unpack();
        if (!prop('IsPresent'))
            return null;

        const percent = Math.round(prop('Percentage'));
        switch (prop('State')) {
        case UPOWER_DEVICE_STATE.CHARGING:
            return `Akku ${percent} % · lädt`;
        case UPOWER_DEVICE_STATE.FULLY_CHARGED:
            return `Akku ${percent} % · voll`;
        default:
            return `Akku ${percent} %`;
        }
    }

    _notificationsText() {
        const count = Main.messageTray.getSources().reduce((n, source) => n + source.count, 0);
        const text = count === 1 ? '1 Benachrichtigung' : `${count || 'Keine'} Benachrichtigungen`;
        const dnd = this._notificationSettings?.get_boolean('show-banners') === false ? ' · Nicht stören' : '';
        return `${text}${dnd}`;
    }

    destroy() {
        this._cancellable.cancel();
        this._battery = null;
        this._notificationSettings = null;
    }
}
