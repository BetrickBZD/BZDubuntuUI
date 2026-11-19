import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {AppearanceModule} from './appearance/module.js';
import {MediaModule} from './media/module.js';
import {PanelModule} from './panel/module.js';

// Every module is self-contained: created on enable, destroyed on disable.
// Further modules go into their own folder and are added here.
const MODULES = [MediaModule, PanelModule, AppearanceModule];

export default class DockMediaExtension extends Extension {
    enable() {
        // One broken module must not take the others down: an exception from
        // enable() makes GNOME unload the stylesheet while the modules
        // started so far keep running unstyled
        this._modules = [];
        for (const Module of MODULES) {
            try {
                this._modules.push(new Module(this));
            } catch (e) {
                console.error(`Dock Media: ${Module.name} failed to start`, e);
            }
        }
    }

    disable() {
        for (const module of this._modules ?? [])
            module.destroy();
        this._modules = null;
    }
}
