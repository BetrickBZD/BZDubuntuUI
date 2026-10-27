import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

/**
 * Square album cover with rounded corners and a note icon while there is
 * no cover. Used by the dock item and the popup.
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

        this._fallback = new St.Icon({icon_name: 'audio-x-generic-symbolic'});
        this.add_child(this._fallback);
    }

    setSize(size) {
        this.set_size(size, size);
        this._fallback.icon_size = Math.round(size * 0.6);
        this._radius = Math.max(4, Math.round(size / 6));
        this._updateStyle();
    }

    setCover(path) {
        this._path = path;
        this._fallback.visible = !path;
        this._updateStyle();
    }

    _updateStyle() {
        const image = this._path
            ? `background-image: url("${this._path}"); background-size: cover;` : '';
        this.style = `${image} border-radius: ${this._radius}px;`;
    }
});
