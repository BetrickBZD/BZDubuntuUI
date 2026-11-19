import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';

import {showDockLabel} from '../lib/dockLabel.js';

/**
 * The top bar's workspace indicator at the top of the dock: one dot per
 * workspace, the active one as a wide pill. Click opens the overview like
 * "Activities", scrolling switches workspaces. Updated only when the
 * workspaces change.
 */
export const WorkspacesItem = GObject.registerClass(
class WorkspacesItem extends Dash.DashItemContainer {
    _init({dash, dockModules}) {
        super._init();
        // Like the dock's own show-apps icon: never take the dock's free space
        this.x_expand = false;
        this.y_expand = false;

        const {Theming, Utils} = dockModules;
        this._side = Utils.getPosition();
        this.label?.add_style_class_name(Theming.PositionStyleClass[this._side]);

        // Built like the dock's app icons, for the same rounded hover tile
        this._dots = new St.BoxLayout({
            style_class: 'bzd-workspaces',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const tile = new St.Bin({style_class: 'overview-icon', child: this._dots});
        this._button = new St.Button({
            style_class: 'overview-tile bzd-edge-tile bzd-workspaces-button',
            track_hover: true,
            can_focus: true,
            child: tile,
        });
        this.setChild(this._button);
        this.setLabelText('Aktivitäten');
        dash._hookUpLabel(this);
        const syncWidth = () => (tile.style = `min-width: ${dash.iconSize}px;`);
        dash.connectObject('icon-size-changed', syncWidth, this);
        syncWidth();

        this._button.connect('clicked', () => Main.overview.toggle());
        // GNOME's own handling, as for scrolling on the top bar
        this._button.connect('scroll-event', (_b, event) => Main.wm.handleWorkspaceScroll(event));
        global.workspace_manager.connectObject(
            'notify::n-workspaces', () => this._sync(),
            'active-workspace-changed', () => this._sync(),
            this);
        this.connect('destroy', () => {
            dash.disconnectObject(this);
            global.workspace_manager.disconnectObject(this);
        });

        this._sync();
        this.show(false);
    }

    showLabel() {
        showDockLabel(this, this._side);
    }

    _sync() {
        const manager = global.workspace_manager;
        const count = manager.n_workspaces;
        const active = manager.get_active_workspace_index();

        while (this._dots.get_n_children() < count)
            this._dots.add_child(new St.Widget({style_class: 'bzd-workspace-dot'}));
        while (this._dots.get_n_children() > count)
            this._dots.get_last_child().destroy();

        this._dots.get_children().forEach((dot, index) => {
            if (index === active)
                dot.add_style_class_name('active');
            else
                dot.remove_style_class_name('active');
        });
    }
});
