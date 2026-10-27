import GnomeDesktop from 'gi://GnomeDesktop';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {DockConnector} from '../lib/dockConnector.js';

import {ClockItem} from './clockItem.js';
import {SystemStatus} from './systemStatus.js';

/**
 * Hides the top bar and puts a ClockItem behind "Show Applications" in
 * every dock instead. Everything is restored on destroy().
 */
export class CompactPanel {
    constructor() {
        this._hidePanel();

        this._clock = new GnomeDesktop.WallClock({time_only: true});
        this._status = new SystemStatus();
        this._dock = new DockConnector((dash, dockModules) => new ClockItem({
            dash,
            dockModules,
            clock: this._clock,
            status: this._status,
        }), {after: true});
    }

    // GNOME reserves the bar's space whether it is visible or not, so it
    // also has to stop being tracked as chrome
    _hidePanel() {
        const {panelBox} = Main.layoutManager;
        Main.layoutManager.untrackChrome(panelBox);
        panelBox.hide();
    }

    _showPanel() {
        const {panelBox} = Main.layoutManager;
        panelBox.show();
        Main.layoutManager.trackChrome(panelBox, {affectsStruts: true, trackFullscreen: true});
    }

    destroy() {
        this._dock.destroy();
        this._status.destroy();
        this._clock = null;
        this._showPanel();
    }
}
