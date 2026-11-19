import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {getMixerControl} from 'resource:///org/gnome/shell/ui/status/volume.js';
import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';

/**
 * The system's sound output for the media popup: the volume of the default
 * output, as in the quick settings, and the output devices to switch
 * between (speakers, headphones, Bluetooth …). Uses GNOME's own mixer.
 * Only listens between start() and stop(), i.e. while the popup is open.
 * Emits 'changed' when the volume, the devices or the active one change.
 */
export class OutputDevices extends EventEmitter {
    constructor() {
        super();
        this._control = getMixerControl();
        this._ids = new Set();
        this._sink = null;
    }

    start() {
        this.stop();
        // The mixer only announces devices once, when they appear: the ones
        // already there are taken from the quick settings' sound output
        const known = Main.panel.statusArea.quickSettings?._volumeOutput?._output?._deviceItems;
        this._ids = new Set(known?.keys() ?? []);

        this._control.connectObject(
            'output-added', (_c, id) => {
                this._ids.add(id);
                this.emit('changed');
            },
            'output-removed', (_c, id) => {
                this._ids.delete(id);
                this.emit('changed');
            },
            'active-output-update', () => this.emit('changed'),
            'default-sink-changed', () => this._connectSink(),
            this);
        this._connectSink();
    }

    stop() {
        this._control.disconnectObject(this);
        this._sink?.disconnectObject(this);
        this._sink = null;
    }

    _connectSink() {
        this._sink?.disconnectObject(this);
        this._sink = this._control.get_default_sink();
        this._sink?.connectObject(
            'notify::volume', () => this.emit('changed'),
            'notify::is-muted', () => this.emit('changed'),
            this);
        this.emit('changed');
    }

    // 0 to 1, or null without an output
    get volume() {
        if (!this._sink)
            return null;
        return this._sink.is_muted ? 0 : Math.min(1, this._sink.volume / this._control.get_vol_max_norm());
    }

    get muted() {
        return Boolean(this._sink?.is_muted);
    }

    // Like the quick settings' slider: 0 mutes, anything else unmutes
    setVolume(value) {
        if (!this._sink)
            return;
        this._sink.volume = value * this._control.get_vol_max_norm();
        if (this._sink.is_muted !== (value === 0))
            this._sink.change_is_muted(value === 0);
        this._sink.push_volume();
    }

    toggleMuted() {
        this._sink?.change_is_muted(!this._sink.is_muted);
    }

    // [{device, name, gicon, active}], the active one marked
    get devices() {
        const active = this._sink ? this._control.lookup_device_from_stream(this._sink) : null;
        return [...this._ids]
            .map(id => this._control.lookup_output_id(id))
            .filter(Boolean)
            .map(device => ({
                device,
                name: device.origin ? `${device.description} – ${device.origin}` : device.description,
                gicon: device.get_gicon(),
                active: Boolean(active) && device.get_id() === active.get_id(),
            }));
    }

    activate(device) {
        this._control.change_output(device);
    }

    destroy() {
        this.stop();
    }
}
