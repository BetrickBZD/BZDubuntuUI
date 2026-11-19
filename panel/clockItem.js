import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';

import {showDockLabel} from '../lib/dockLabel.js';

import {barMenuButtons, closeBarMenus, toggleBarMenu} from './barMenu.js';
import {BatteryView} from './batteryView.js';

/**
 * The clock in the dock, behind "Show Applications". Hover shows the
 * SystemStatus, left click opens calendar and notifications, right click
 * the quick settings (both normally hang off the hidden top bar), or the
 * other way round with 'clock-swap-clicks'; with 'unified-panel' both open
 * the one panel holding all of it. A dot next to the time marks
 * unread notifications, like next to the top bar's clock, and the battery
 * shows below the time ('compact-battery'), all in a pill of its own with
 * 'clock-pill'.
 */
export const ClockItem = GObject.registerClass(
class ClockItem extends Dash.DashItemContainer {
    _init({dash, dockModules, clock, status, settings}) {
        super._init();
        // Like the dock's own show-apps icon: never take the dock's free space
        this.x_expand = false;
        this.y_expand = false;

        this._status = status;
        this._dockBackground = dash._background;
        const {Theming, Utils} = dockModules;
        this._side = Utils.getPosition();
        this.label?.add_style_class_name(Theming.PositionStyleClass[this._side]);

        // Built like the dock's app icons (overview-tile), so the theme gives
        // the clock the same rounded hover tile as every other icon. The tile
        // is at least one icon wide, the time keeps its natural width and
        // sits in its middle.
        const time = new St.Label({
            style_class: 'dock-clock-time',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const timeRow = new St.BoxLayout({
            style_class: 'bzd-clock-content',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        // GNOME's own unread state; an invisible twin on the left keeps the
        // time centered while the dot shows
        const dot = new St.Widget({style_class: 'bzd-clock-dot', y_align: Clutter.ActorAlign.CENTER});
        const pad = new St.Widget({style_class: 'bzd-clock-dot', opacity: 0, y_align: Clutter.ActorAlign.CENTER});
        timeRow.add_child(pad);
        timeRow.add_child(time);
        timeRow.add_child(dot);
        const battery = new BatteryView();
        const content = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        content.add_child(timeRow);
        content.add_child(battery);
        const unread = Main.panel.statusArea.dateMenu?._indicator;
        const bindings = unread
            ? [dot, pad].map(a => unread.bind_property('visible', a, 'visible', GObject.BindingFlags.SYNC_CREATE))
            : [];
        if (!unread)
            dot.visible = pad.visible = false;
        const tile = new St.Bin({style_class: 'overview-icon', child: content});
        this._button = new St.Button({
            style_class: 'overview-tile bzd-edge-tile dock-clock',
            track_hover: true,
            can_focus: true,
            button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE,
            child: tile,
        });
        this.setChild(this._button);
        dash._hookUpLabel(this);
        // A bit more room in the tile while the battery shows
        const syncTile = () => {
            if (battery.visible)
                this._button?.add_style_class_name('bzd-clock-battery');
            else
                this._button?.remove_style_class_name('bzd-clock-battery');
        };
        battery.connect('notify::visible', syncTile);
        const syncBattery = () => {
            battery.enabled = settings.get_boolean('compact-battery');
            battery.colored = settings.get_boolean('battery-colors');
        };
        const syncPill = () => {
            if (settings.get_boolean('clock-pill'))
                this._button?.add_style_class_name('bzd-dock-pill');
            else
                this._button?.remove_style_class_name('bzd-dock-pill');
        };
        settings.connectObject(
            'changed::compact-battery', syncBattery,
            'changed::battery-colors', syncBattery,
            'changed::clock-pill', syncPill,
            this);
        syncBattery();
        syncPill();
        syncTile();
        const syncWidth = () => (tile.style = `min-width: ${dash.iconSize}px;`);
        dash.connectObject('icon-size-changed', syncWidth, this);
        syncWidth();

        const binding = clock.bind_property('clock', time, 'text', GObject.BindingFlags.SYNC_CREATE);

        const toggle = quick => {
            const {dateMenu, quickSettings} = Main.panel.statusArea;
            toggleBarMenu((quick ? quickSettings : dateMenu)?.menu, {
                owner: this,
                button: this._button,
                side: this._side,
                dockBackground: this._dockBackground,
                settings,
            });
        };
        this._button.connect('clicked', (_b, button) => {
            const secondary = button === Clutter.BUTTON_SECONDARY;
            toggle(settings.get_boolean('unified-panel') ||
                secondary !== settings.get_boolean('clock-swap-clicks'));
        });
        const clockButton = this._button;
        barMenuButtons.set(clockButton, () => {
            if (!Main.panel.statusArea.quickSettings?.menu.isOpen)
                toggle(true);
        });
        this.connect('destroy', () => {
            this._status = null;
            binding.unbind();
            bindings.forEach(b => b.unbind());
            dash.disconnectObject(this);
            settings.disconnectObject(this);
            barMenuButtons.delete(clockButton);
            closeBarMenus(this._button);
            // A menu still in its close animation stops following the clock
            this._button = null;
        });

        this.show(false);
    }

    showLabel() {
        // The dock's hover timeout can still fire after the clock is gone
        if (!this._status)
            return;
        this.setLabelText(this._status.describe());
        showDockLabel(this, this._side);
    }
});
