import {DockConnector} from '../lib/dockConnector.js';
import {Module} from '../lib/module.js';

import {DockMediaItem} from './dockItem.js';
import {MediaController} from './controller.js';

/**
 * Media module: one MediaController (the model) shared by a DockMediaItem
 * (the view, with its MediaMenu) in every dock.
 */
export class MediaModule extends Module {
    constructor(extension) {
        super(extension);
        this._controller = new MediaController();
        this._dock = new DockConnector((dash, dockModules) => new DockMediaItem({
            dash,
            dockModules,
            controller: this._controller,
            settings: this.settings,
            openPreferences: () => this.openPreferences(),
        }));
    }

    destroy() {
        this._dock.destroy();
        this._controller.destroy();
        super.destroy();
    }
}
