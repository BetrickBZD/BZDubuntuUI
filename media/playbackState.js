import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';

const MPRIS_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';
const PROPERTIES_IFACE = 'org.freedesktop.DBus.Properties';

// Changes after which the position has to be read again
const POSITION_PROPS = ['PlaybackStatus', 'Metadata', 'Rate', 'CanSeek'];

// Repeat button: each click goes to the next mode
export const LOOP_ORDER = ['None', 'Playlist', 'Track'];

/**
 * What GNOME's MprisPlayer doesn't tell for one player: the playback
 * position, shuffle and repeat. Only runs between start() and stop(), i.e.
 * while the popup is open. Everything is read in one D-Bus call; the
 * player's change signals then keep it current, and the position is
 * counted on locally, since MPRIS doesn't announce it while it moves.
 * Emits 'changed' about once a second while playing, or, with a
 * `resolution` (setResolution()), only as often as the position moves by
 * one of that many steps of the track, but never more than once a second.
 * Times are in
 * microseconds, as in MPRIS; shuffle and loopStatus are null when the
 * player doesn't support them.
 */
export class PlaybackState extends EventEmitter {
    constructor() {
        super();
        this.length = 0;
        this.canSeek = false;
        this.shuffle = null;
        this.loopStatus = null;
        this._busName = null;
        this._trackId = null;
        this._base = 0;
        this._baseTime = 0;
        this._rate = 1;
        this._playing = false;
        this._canControl = false;
        this._signalIds = [];
        this._timerId = 0;
        this._resolution = 0;
        this._cancellable = null;
    }

    // steps: how finely the track's progress is shown (0 for to the
    // second, as a time display needs); the timer follows right away
    setResolution(steps) {
        if (steps === this._resolution)
            return;
        this._resolution = steps;
        this._startTimer();
    }

    // Seconds between two ticks: whole ones, so GLib can bundle the
    // wakeup with others
    _interval() {
        if (!this._resolution)
            return 1;
        return Math.max(1, Math.floor(this.length / 1e6 / this._resolution));
    }

    get position() {
        const elapsed = this._playing ? (GLib.get_monotonic_time() - this._baseTime) * this._rate : 0;
        return Math.clamp(this._base + elapsed, 0, this.length || Infinity);
    }

    // The bus name is GNOME's own (MprisPlayer), there is no public getter
    start(player) {
        this.stop();
        this._busName = player?._busName ?? null;
        if (!this._busName)
            return;

        const bus = Gio.DBus.session;
        this._signalIds = [
            bus.signal_subscribe(this._busName, PLAYER_IFACE, 'Seeked', MPRIS_PATH, null,
                Gio.DBusSignalFlags.NONE, (...args) => {
                    [this._base] = args[5].deepUnpack();
                    this._baseTime = GLib.get_monotonic_time();
                    this.emit('changed');
                }),
            bus.signal_subscribe(this._busName, PROPERTIES_IFACE, 'PropertiesChanged', MPRIS_PATH,
                PLAYER_IFACE, Gio.DBusSignalFlags.NONE, (...args) => {
                    const [, changed] = args[5].recursiveUnpack();
                    this._onPropertiesChanged(changed);
                }),
        ];
        this.refresh();
    }

    // One call for everything
    refresh() {
        if (!this._busName)
            return;
        this._cancellable?.cancel();
        const cancellable = this._cancellable = new Gio.Cancellable();
        Gio.DBus.session.call(this._busName, MPRIS_PATH, PROPERTIES_IFACE, 'GetAll',
            new GLib.Variant('(s)', [PLAYER_IFACE]), new GLib.VariantType('(a{sv})'),
            Gio.DBusCallFlags.NONE, 1000, cancellable, (connection, result) => {
                let props;
                try {
                    [props] = connection.call_finish(result).recursiveUnpack();
                } catch (e) {
                    if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        this._update({});
                    return;
                }
                this._update(props);
            });
    }

    _onPropertiesChanged(changed) {
        if (POSITION_PROPS.some(name => name in changed)) {
            this.refresh();
            return;
        }
        if ('Shuffle' in changed)
            this.shuffle = changed.Shuffle;
        if ('LoopStatus' in changed)
            this.loopStatus = changed.LoopStatus;
        this.emit('changed');
    }

    _update(props) {
        const {Position = 0, Metadata = {}, CanSeek = false, PlaybackStatus = '', Rate = 1} = props;
        this._base = Position;
        this._baseTime = GLib.get_monotonic_time();
        this._rate = Rate || 1;
        this._playing = PlaybackStatus === 'Playing';
        this.length = Metadata['mpris:length'] ?? 0;
        this._trackId = Metadata['mpris:trackid'] ?? null;
        this.canSeek = CanSeek && Boolean(this._trackId) && this.length > 0;
        this._canControl = props.CanControl ?? false;
        this.shuffle = this._canControl ? props.Shuffle ?? null : null;
        this.loopStatus = this._canControl && LOOP_ORDER.includes(props.LoopStatus) ? props.LoopStatus : null;

        this._startTimer();
        this.emit('changed');
    }

    _startTimer() {
        this._stopTimer();
        if (!this._playing || this.length <= 0)
            return;
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._interval(), () => {
            this.emit('changed');
            return GLib.SOURCE_CONTINUE;
        });
    }

    // fraction: 0 to 1 of the track
    seek(fraction) {
        if (!this.canSeek)
            return;
        const position = Math.round(fraction * this.length);
        Gio.DBus.session.call(this._busName, MPRIS_PATH, PLAYER_IFACE, 'SetPosition',
            new GLib.Variant('(ox)', [this._trackId, position]), null,
            Gio.DBusCallFlags.NONE, 1000, null, null);
        this._base = position;
        this._baseTime = GLib.get_monotonic_time();
        this.emit('changed');
    }

    setShuffle(shuffle) {
        if (this.shuffle !== null)
            this._set('Shuffle', new GLib.Variant('b', shuffle), () => (this.shuffle = shuffle));
    }

    setLoopStatus(loopStatus) {
        if (this.loopStatus !== null)
            this._set('LoopStatus', new GLib.Variant('s', loopStatus), () => (this.loopStatus = loopStatus));
    }

    // Shown right away; the player confirms with PropertiesChanged
    _set(name, value, apply) {
        Gio.DBus.session.call(this._busName, MPRIS_PATH, PROPERTIES_IFACE, 'Set',
            new GLib.Variant('(ssv)', [PLAYER_IFACE, name, value]), null,
            Gio.DBusCallFlags.NONE, 1000, null, null);
        apply();
        this.emit('changed');
    }

    _stopTimer() {
        if (this._timerId)
            GLib.source_remove(this._timerId);
        this._timerId = 0;
    }

    stop() {
        this._stopTimer();
        this._cancellable?.cancel();
        this._cancellable = null;
        for (const id of this._signalIds)
            Gio.DBus.session.signal_unsubscribe(id);
        this._signalIds = [];
        this._busName = null;
        this.length = 0;
        this.canSeek = false;
        this.shuffle = null;
        this.loopStatus = null;
        this.emit('changed');
    }

    destroy() {
        this.stop();
    }
}
