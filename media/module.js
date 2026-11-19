import {DockConnector} from '../lib/dockConnector.js';
import {Module} from '../lib/module.js';

import {DockMediaItem} from './dockItem.js';
import {MediaController} from './controller.js';
import {PanelMediaHider} from './panelMediaHider.js';

/**
 * Media module: one MediaController (the model) shared by a DockMediaItem
 * (the view, with its MediaMenu) in every dock. A PanelMediaHider takes
 * GNOME's own media card out of the notification list ('hide-panel-media').
 */
export class MediaModule extends Module {
    constructor(extension) {
        super(extension);
        this._controller = new MediaController(this.settings);
        this._dock = new DockConnector((dash, dockModules) => new DockMediaItem({
            dash,
            dockModules,
            controller: this._controller,
            settings: this.settings,
        }), {order: 1}); // in front of "Show Applications" and the status icons
        this._hider = null;
        this.settings.connectObject('changed::hide-panel-media', () => this._syncHider(), this);
        this._syncHider();
    }

    _syncHider() {
        const hidden = this.settings.get_boolean('hide-panel-media');
        if (hidden && !this._hider) {
            this._hider = new PanelMediaHider();
        } else if (!hidden && this._hider) {
            this._hider.destroy();
            this._hider = null;
        }
    }

    destroy() {
        this.settings.disconnectObject(this);
        this._hider?.destroy();
        this._hider = null;
        this._dock.destroy();
        this._controller.destroy();
        super.destroy();
    }
}
