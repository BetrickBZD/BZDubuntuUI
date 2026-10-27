import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {MediaModule} from './media/module.js';
import {PanelModule} from './panel/module.js';

// Every module is self-contained: created on enable, destroyed on disable.
// Further modules go into their own folder and are added here.
const MODULES = [MediaModule, PanelModule];

export default class DockMediaExtension extends Extension {
    enable() {
        this._modules = MODULES.map(Module => new Module(this));
    }

    disable() {
        for (const module of this._modules ?? [])
            module.destroy();
        this._modules = null;
    }
}
