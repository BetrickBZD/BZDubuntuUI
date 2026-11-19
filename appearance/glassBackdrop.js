import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';

import {averageColor} from '../lib/color.js';

Gio._promisify(Gio.File.prototype, 'query_info_async');
Gio._promisify(Gio.File.prototype, 'read_async');
Gio._promisify(GdkPixbuf.Pixbuf, 'new_from_stream_at_scale_async', 'new_from_stream_finish');

const CACHE_VERSION = 3;
// The frosted wallpaper is computed at this share of the monitor's size:
// blurred that much, St stretching it shows no steps
const SCALE = 1 / 4;
// The static blur's softness against the live blur's radius, which it
// matches by eye
const SOFTNESS = 0.75;
// Strength of the noise against banding in dark, smooth gradients, in
// levels of 255
const DITHER = 1.5;

/**
 * The frosted glass image: the current wallpaper, cropped like GNOME's
 * "zoom" to the primary monitor, blurred, a bit more saturated and
 * darkened, as setLook() says ({blurRadius, saturation, brightness}): as
 * far and as dark as the live blur behind popups, so the dock and windows
 * look like them. Computed once per wallpaper and look (asynchronously, so
 * login doesn't stutter) and cached; `path` is null until it is ready.
 * `color` is the wallpaper's average color ({red, green, blue}) for the
 * glass to be tinted with, or null. Emits 'changed'.
 */
export class GlassBackdrop extends EventEmitter {
    constructor() {
        super();
        this._look = null;
        this._lookKey = '';
        this.path = null;
        this.color = null;
        // Whether a new image is being computed
        this.pending = false;
        this._cancellable = null;
        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'dock-media']);
        GLib.mkdir_with_parents(this._cacheDir, 0o755);

        this._background = new Gio.Settings({schema_id: 'org.gnome.desktop.background'});
        this._interface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        this._background.connectObject('changed', () => this._update(), this);
        this._interface.connectObject('changed::color-scheme', () => this._update(), this);
        Main.layoutManager.connectObject('monitors-changed', () => this._update(), this);
    }

    setLook(look) {
        const key = JSON.stringify(look);
        if (key === this._lookKey)
            return;
        this._look = look;
        this._lookKey = key;
        this._update();
    }

    _wallpaper() {
        const dark = this._interface.get_string('color-scheme') === 'prefer-dark';
        const uri = (dark && this._background.get_string('picture-uri-dark')) ||
            this._background.get_string('picture-uri');
        return uri ? Gio.File.new_for_uri(uri) : null;
    }

    async _update() {
        if (!this._look)
            return;
        this._cancellable?.cancel();
        const cancellable = this._cancellable = new Gio.Cancellable();
        this.pending = true;
        const file = this._wallpaper();
        const monitor = Main.layoutManager.primaryMonitor;

        let path = null, color = null;
        try {
            if (file && monitor)
                ({path, color} = await this._render(file, monitor, cancellable));
        } catch (e) {
            if (e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;
            console.warn(`Dock Media: no glass backdrop from wallpaper: ${e.message}`);
        }
        // Also when nothing changed: whoever waited for it goes on
        this.pending = false;
        this.path = path;
        this.color = color;
        this.emit('changed');
    }

    async _render(file, monitor, cancellable) {
        const info = await file.query_info_async('time::modified', Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_LOW, cancellable);
        const modified = info.get_modification_date_time()?.to_unix() ?? 0;
        const look = this._look;
        const aspect = monitor.width / monitor.height;
        const width = Math.max(64, Math.round(monitor.width * SCALE));
        const key = `${file.get_uri()}:${modified}:${aspect.toFixed(3)}:${width}:${this._lookKey}:${CACHE_VERSION}`;
        const name = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA1, key, -1);
        const path = GLib.build_filenamev([this._cacheDir, `glass-${name}.png`]);
        const colorPath = GLib.build_filenamev([this._cacheDir, `glass-${name}.json`]);
        if (GLib.file_test(path, GLib.FileTest.EXISTS) && GLib.file_test(colorPath, GLib.FileTest.EXISTS)) {
            try {
                const [, bytes] = GLib.file_get_contents(colorPath);
                return {path, color: JSON.parse(new TextDecoder().decode(bytes))};
            } catch {
                // Rendered anew below
            }
        }

        // Decoding at a small size is fast
        const stream = await file.read_async(GLib.PRIORITY_LOW, cancellable);
        const decoded = await GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(
            stream, width * 2, -1, true, cancellable);
        stream.close(null);

        const small = cropToAspect(decoded, aspect)
            .scale_simple(width, Math.round(width / aspect), GdkPixbuf.InterpType.BILINEAR);
        const vivid = small.copy();
        small.saturate_and_pixelate(vivid, look.saturation, false);

        // As soft as the live blur, whose radius is in screen pixels
        const sigma = look.blurRadius * SOFTNESS * width / monitor.width;
        frost(vivid, sigma, Math.clamp(look.brightness, 0, 1)).savev(path, 'png', [], []);
        const color = averageColor(vivid);
        GLib.file_set_contents(colorPath, JSON.stringify(color));
        return {path, color};
    }

    destroy() {
        this._cancellable?.cancel();
        this._background.disconnectObject(this);
        this._interface.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
        this.path = null;
    }
}

// The image blurred like with a Gaussian of `sigma` px (three box blurs in
// a row come very close to one), darkened to `brightness` like the live
// blur, with a little noise against banding; a new RGB pixbuf
function frost(pixbuf, sigma, brightness) {
    const {width, height, rowstride} = pixbuf;
    const channels = pixbuf.n_channels;
    const pixels = pixbuf.get_pixels();
    const data = new Float32Array(width * height * 3);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            for (let c = 0; c < 3; c++)
                data[(y * width + x) * 3 + c] = pixels[y * rowstride + x * channels + c];
        }
    }

    // Box radius whose three passes give about this sigma
    const radius = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
    for (let pass = 0; pass < 3; pass++) {
        boxBlur(data, width, height, radius, 3, width * 3);
        boxBlur(data, height, width, radius, width * 3, 3);
    }

    const out = new Uint8Array(width * height * 3);
    let seed = 12345;
    for (let i = 0; i < out.length; i++) {
        // A small, fixed pseudo-random noise, the same each time
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const noise = (seed / 0x7fffffff - 0.5) * 2 * DITHER;
        out[i] = Math.clamp(Math.round(data[i] * brightness + noise), 0, 255);
    }
    return GdkPixbuf.Pixbuf.new_from_bytes(new GLib.Bytes(out),
        GdkPixbuf.Colorspace.RGB, false, 8, width, height, width * 3);
}

// One box blur along lines of `length` samples `step` apart, `count` lines
// `lineStep` apart, for each of the three channels; edges repeat
function boxBlur(data, length, count, radius, step, lineStep) {
    const line = new Float32Array(length);
    const size = 2 * radius + 1;
    for (let l = 0; l < count; l++) {
        for (let c = 0; c < 3; c++) {
            const start = l * lineStep + c;
            for (let i = 0; i < length; i++)
                line[i] = data[start + i * step];
            let sum = 0;
            for (let i = -radius; i <= radius; i++)
                sum += line[Math.clamp(i, 0, length - 1)];
            for (let i = 0; i < length; i++) {
                data[start + i * step] = sum / size;
                sum += line[Math.min(i + radius + 1, length - 1)] - line[Math.max(i - radius, 0)];
            }
        }
    }
}

// Center crop to the monitor's aspect ratio, like the "zoom" wallpaper option
function cropToAspect(pixbuf, aspect) {
    const {width, height} = pixbuf;
    if (width / height > aspect) {
        const w = Math.round(height * aspect);
        return pixbuf.new_subpixbuf(Math.floor((width - w) / 2), 0, w, height);
    }
    const h = Math.round(width / aspect);
    return pixbuf.new_subpixbuf(0, Math.floor((height - h) / 2), width, h);
}
