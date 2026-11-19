import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

const FADE_DURATION = 250; // ms

/**
 * Square album cover with rounded corners and a note icon while there is
 * no cover. Used by the dock item and the popup. With `crossfade` a new
 * cover fades in over the old one. The dock's cover can also show the
 * track's progress as a ring along its edge (setRing(), setProgress()) and
 * a shade with a pause badge while paused (setPaused()).
 */
export const CoverView = GObject.registerClass(
class CoverView extends St.Widget {
    _init(params = {}) {
        super._init({
            style_class: 'dock-media-cover',
            layout_manager: new Clutter.BinLayout(),
            ...params,
        });
        this._path = null;
        this._radius = 0;
        this._ringWidth = 0;
        this._progress = null;
        this.crossfade = false;

        this._fallback = new St.Icon({icon_name: 'audio-x-generic-symbolic'});
        this.add_child(this._fallback);

        this._shade = new St.Widget({style_class: 'dock-media-paused-shade', x_expand: true, y_expand: true, visible: false});
        this._badge = new St.Icon({
            style_class: 'dock-media-badge',
            icon_name: 'media-playback-pause-symbolic',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        this.add_child(this._shade);
        this.add_child(this._badge);
    }

    setSize(size) {
        this.set_size(size, size);
        this._fallback.icon_size = Math.round(size * 0.6);
        this._badge.icon_size = Math.round(size * 0.36);
        this._radius = Math.max(4, Math.round(size / 6));
        this._updateStyle();
        this._ring?.queue_repaint();
    }

    setCover(path) {
        if (path === this._path)
            return;
        if (this.crossfade && this._path && this.mapped)
            this._fadeOut(this.style);
        this._path = path;
        this._fallback.visible = !path;
        this._updateStyle();
    }

    // The old cover on top, fading out to the new one below
    _fadeOut(style) {
        const old = new St.Widget({style, x_expand: true, y_expand: true});
        this.insert_child_below(old, this._shade);
        old.ease({
            opacity: 0,
            duration: FADE_DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => old.destroy(),
        });
    }

    // Only on a new cover or size: the dock syncs on every player change,
    // and setting the style restyles the actor, even to the same one
    _updateStyle() {
        const image = this._path
            ? `background-image: url("${this._path}"); background-size: cover;` : '';
        const style = `${image} border-radius: ${this._radius}px;`;
        if (this.style !== style)
            this.style = style;
        const shade = `border-radius: ${this._radius}px;`;
        if (this._shade.style !== shade)
            this._shade.style = shade;
    }

    // width in px, 0 for no ring
    setRing(width) {
        this._ringWidth = width;
        if (width && !this._ring) {
            this._ring = new St.DrawingArea({style_class: 'dock-media-ring', x_expand: true, y_expand: true});
            this._ring.connect('repaint', area => this._drawRing(area));
            this.add_child(this._ring);
        } else if (!width && this._ring) {
            this._ring.destroy();
            this._ring = null;
        }
        this._ring?.queue_repaint();
    }

    // 0 to 1, or null when unknown
    setProgress(fraction) {
        if (fraction === this._progress)
            return;
        this._progress = fraction;
        this._ring?.queue_repaint();
    }

    setPaused(paused) {
        this._shade.visible = paused;
        this._badge.visible = paused;
    }

    // The rounded edge from the top middle clockwise, as far as the track
    // has played, over a faint track of the whole edge
    _drawRing(area) {
        const cr = area.get_context();
        const [width, height] = area.get_surface_size();
        const line = this._ringWidth;
        const inset = line / 2;
        const [x0, y0, x1, y1] = [inset, inset, width - inset, height - inset];
        const r = Math.max(0, Math.min(this._radius - inset, (x1 - x0) / 2));

        cr.moveTo((x0 + x1) / 2, y0);
        cr.lineTo(x1 - r, y0);
        cr.arc(x1 - r, y0 + r, r, -Math.PI / 2, 0);
        cr.lineTo(x1, y1 - r);
        cr.arc(x1 - r, y1 - r, r, 0, Math.PI / 2);
        cr.lineTo(x0 + r, y1);
        cr.arc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
        cr.lineTo(x0, y0 + r);
        cr.arc(x0 + r, y0 + r, r, Math.PI, 3 * Math.PI / 2);
        cr.closePath();
        cr.setLineWidth(line);

        // Cairo refuses a dash of length 0 (a track at its very start): then
        // there is only the faint track. The context goes in any case, or
        // each failed repaint would leak one
        try {
            if (this._progress !== null) {
                const perimeter = 2 * (x1 - x0 + y1 - y0) - 8 * r + 2 * Math.PI * r;
                const played = perimeter * Math.clamp(this._progress, 0, 1);
                cr.setSourceRGBA(0, 0, 0, 0.35);
                cr.strokePreserve();
                if (played >= 0.5) {
                    const color = area.get_theme_node().get_foreground_color();
                    cr.setSourceRGBA(color.red / 255, color.green / 255, color.blue / 255, color.alpha / 255);
                    cr.setDash([played, perimeter], 0);
                    cr.stroke();
                }
            }
        } finally {
            cr.$dispose();
        }
    }
});
