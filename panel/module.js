import {Module} from '../lib/module.js';

import {CompactPanel} from './compactPanel.js';
import {SettingsShortcut} from './settingsShortcut.js';
import {UnifiedPanel} from './unifiedPanel.js';

/**
 * Panel module: switches between GNOME's original top bar and the
 * CompactPanel ('compact-panel'), adds the SettingsShortcut to the quick
 * settings ('menu-settings-button') and puts quick settings, notifications
 * and calendar into one UnifiedPanel ('unified-panel').
 */
export class PanelModule extends Module {
    constructor(extension) {
        super(extension);
        this._compactPanel = null;
        this._shortcut = null;
        this._unified = null;
        this.settings.connectObject(
            'changed::compact-panel', () => this._syncCompactPanel(),
            'changed::menu-settings-button', () => this._syncShortcut(),
            'changed::unified-panel', () => this._syncUnified(),
            this);
        this._syncCompactPanel();
        this._syncShortcut();
        this._syncUnified();
    }

    _syncUnified() {
        const unified = this.settings.get_boolean('unified-panel');
        if (unified && !this._unified) {
            this._unified = new UnifiedPanel(this.settings);
        } else if (!unified && this._unified) {
            this._unified.destroy();
            this._unified = null;
        }
    }

    _syncCompactPanel() {
        const compact = this.settings.get_boolean('compact-panel');
        if (compact && !this._compactPanel) {
            this._compactPanel = new CompactPanel(this.settings);
        } else if (!compact && this._compactPanel) {
            this._compactPanel.destroy();
            this._compactPanel = null;
        }
    }

    _syncShortcut() {
        const shown = this.settings.get_boolean('menu-settings-button');
        if (shown && !this._shortcut) {
            this._shortcut = new SettingsShortcut(() => this.openPreferences());
        } else if (!shown && this._shortcut) {
            this._shortcut.destroy();
            this._shortcut = null;
        }
    }

    destroy() {
        this.settings.disconnectObject(this);
        this._unified?.destroy();
        this._unified = null;
        this._compactPanel?.destroy();
        this._compactPanel = null;
        this._shortcut?.destroy();
        this._shortcut = null;
        super.destroy();
    }
}
