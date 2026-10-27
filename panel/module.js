import {Module} from '../lib/module.js';

import {CompactPanel} from './compactPanel.js';

/**
 * Panel module: switches between GNOME's original top bar and the
 * CompactPanel, following the 'compact-panel' setting.
 */
export class PanelModule extends Module {
    constructor(extension) {
        super(extension);
        this._compactPanel = null;
        this.settings.connectObject('changed::compact-panel', () => this._sync(), this);
        this._sync();
    }

    _sync() {
        const compact = this.settings.get_boolean('compact-panel');
        if (compact && !this._compactPanel) {
            this._compactPanel = new CompactPanel();
        } else if (!compact && this._compactPanel) {
            this._compactPanel.destroy();
            this._compactPanel = null;
        }
    }

    destroy() {
        this.settings.disconnectObject(this);
        this._compactPanel?.destroy();
        this._compactPanel = null;
        super.destroy();
    }
}
