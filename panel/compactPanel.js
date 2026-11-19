import GnomeDesktop from 'gi://GnomeDesktop';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {DockConnector} from '../lib/dockConnector.js';

import {ClockItem} from './clockItem.js';
import {StatusArea} from './statusArea.js';
import {SystemStatus} from './systemStatus.js';
import {WorkspacesItem} from './workspacesItem.js';

/**
 * Hides the top bar and puts its parts into every dock instead: a
 * WorkspacesItem at the top, a ClockItem (with the battery) behind "Show
 * Applications" at the dock's end, and the bar's StatusArea right in front
 * of "Show Applications", between it and the media cover
 * ('compact-status-icons', main dock only).
 * Everything is restored on destroy().
 */
export class CompactPanel {
    constructor(settings) {
        this._settings = settings;
        this._hidePanel();

        this._clock = new GnomeDesktop.WallClock({time_only: true});
        this._status = new SystemStatus();
        this._dock = new DockConnector((dash, dockModules) => new ClockItem({
            dash,
            dockModules,
            clock: this._clock,
            status: this._status,
            settings,
        }), {after: true});
        this._workspaces = new DockConnector((dash, dockModules) =>
            new WorkspacesItem({dash, dockModules}), {start: true});

        // Only in the main dock: an indicator can be in one place only.
        // Right in front of "Show Applications", nearer than the cover: it
        // comes and goes with the apps that have tray icons, and so moves
        // only what is in front of it, never the grid or the clock
        this._statusIcons = null;
        settings.connectObject(
            'changed::compact-status-icons', () => this._syncStatusIcons(),
            'changed::status-collapse', () => {
                this._statusIcons?.destroy();
                this._statusIcons = null;
                this._syncStatusIcons();
            },
            this);
        this._syncStatusIcons();
    }

    _syncStatusIcons() {
        const shown = this._settings.get_boolean('compact-status-icons');
        if (shown && !this._statusIcons) {
            this._statusIcons = new DockConnector((dash, dockModules, {main}) => main
                ? new StatusArea({dash, dockModules, settings: this._settings})
                : null, {order: 2});
        } else if (!shown && this._statusIcons) {
            this._statusIcons.destroy();
            this._statusIcons = null;
        }
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
        this._settings.disconnectObject(this);
        this._statusIcons?.destroy();
        this._statusIcons = null;
        this._workspaces.destroy();
        this._dock.destroy();
        this._status.destroy();
        this._clock = null;
        this._showPanel();
    }
}
