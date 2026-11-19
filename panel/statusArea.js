import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {placeNextToDock} from '../lib/dockPlacement.js';

import {StatusTray} from './statusTray.js';

// These stay in the bar: the dock has its own workspace indicator, and the
// clock opens calendar and quick settings
const KEEP_ROLES = ['activities', 'dateMenu', 'quickSettings'];

// Warnings that always stay in the dock, in their color: indicator class
// -> tile class
const ALERTS = {
    'screen-recording-indicator': 'bzd-status-recording',
    'screen-sharing-indicator': 'bzd-status-sharing',
};

const placeholders = new WeakSet();

/**
 * The top bar's status icons in the dock while the bar is hidden: tray
 * icons of apps, screen recording and sharing, keyboard layout,
 * accessibility and the indicators of other extensions. They are moved, not
 * copied, so they keep all their behavior and show only while they would
 * show in the bar; their menus open next to the dock. With
 * 'status-collapse' all but the warnings go behind one button, the
 * StatusTray. Indicators the bar gets later (an app starting) follow.
 * destroy() puts every one back exactly where it was.
 */
export const StatusArea = GObject.registerClass(
class StatusArea extends St.BoxLayout {
    _init({dash, dockModules, settings}) {
        const side = dockModules.Utils.getPosition();
        const vertical = side === St.Side.LEFT || side === St.Side.RIGHT;
        super._init({
            style_class: 'dash-item-container bzd-status-area',
            orientation: vertical ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL,
            // Like the dock's own items: never take the dock's free space
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        // Runs before the tiles are destroyed, so their indicators survive
        this.connect('destroy', () => this._onDestroy());

        this._dock = {side, dockBackground: dash._background, settings};
        this._iconSize = dash.iconSize;
        this._icons = new Map(); // actor of the bar -> StatusIcon
        this._tray = null;
        if (settings.get_boolean('status-collapse')) {
            this._tray = new StatusTray(this._dock);
            this._tray.setSize(this._iconSize);
            this.add_child(this._tray.button);
        }
        this._later = 0;
        const {_leftBox, _centerBox, _rightBox} = Main.panel;
        this._boxes = [_leftBox, _centerBox, _rightBox];

        dash.connectObject('icon-size-changed', () => {
            this._iconSize = dash.iconSize;
            this._tray?.setSize(this._iconSize);
            for (const icon of this._icons.values())
                icon.setSize(this._iconSize);
        }, this);
        for (const box of this._boxes)
            box.connectObject('child-added', () => this._queueAdopt(), this);
        this._adoptAll();
    }

    // Not while the bar is still adding it
    _queueAdopt() {
        if (this._later)
            return;
        this._later = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._later = 0;
            this._adoptAll();
            return GLib.SOURCE_REMOVE;
        });
    }

    _adoptAll() {
        const keep = KEEP_ROLES.map(role => Main.panel.statusArea[role]?.container);
        for (const box of this._boxes) {
            for (const actor of box.get_children()) {
                if (!keep.includes(actor) && !placeholders.has(actor) && !this._icons.has(actor))
                    this._adopt(actor);
            }
        }
    }

    _adopt(actor) {
        const inTray = Boolean(this._tray) && !alertClass(actor);
        const icon = new StatusIcon(actor, inTray ? {...this._tray.place, inTray} : this._dock,
            this._iconSize);
        this._icons.set(actor, icon);
        // In the order of the bar, given by the placeholders, among the
        // icons in the same place; in the dock behind the tray's button
        const icons = [...this._icons.values()].filter(other => other.inTray === inTray);
        const order = this._boxes
            .flatMap(box => box.get_children())
            .filter(child => icons.some(other => other.placeholder === child));
        const box = inTray ? this._tray.box : this;
        const first = box === this && this._tray ? 1 : 0;
        box.insert_child_at_index(icon.tile, first + order.indexOf(icon.placeholder));

        icon.tile.connectObject(
            'notify::visible', () => this._syncVisible(),
            'destroy', () => {
                this._icons.delete(actor);
                this._syncVisible();
            }, this);
        this._syncVisible();
    }

    // Hidden while no indicator shows, so the dock has no gap
    _syncVisible() {
        const icons = [...this._icons.values()];
        this._tray?.setHasIcons(icons.some(icon => icon.inTray && icon.tile.visible));
        this.visible = Boolean(this._tray?.button.visible) ||
            icons.some(icon => !icon.inTray && icon.tile.visible);
    }

    _onDestroy() {
        for (const box of this._boxes)
            box.disconnectObject(this);
        if (this._later)
            global.compositor.get_laters().remove(this._later);
        this._later = 0;
        for (const icon of this._icons.values()) {
            icon.tile.disconnectObject(this);
            icon.restore();
        }
        this._icons.clear();
        this._tray?.destroy();
    }
});

/**
 * One actor of the top bar in a tile of ours: in the dock like the clock's,
 * or in the tray's popup (inTray). A hidden placeholder keeps its place in
 * the bar. Lets go of it, tile and placeholder gone, when it is destroyed
 * or someone else moves it. dockBackground is what its menu opens next to.
 */
class StatusIcon {
    constructor(actor, {side, dockBackground, settings, inTray = false}, size) {
        this._actor = actor;
        this._side = side;
        this._dockBackground = dockBackground;
        this._settings = settings;
        this.inTray = inTray;
        this._menu = null;

        this.placeholder = new Clutter.Actor({visible: false});
        placeholders.add(this.placeholder);
        const box = actor.get_parent();
        box.insert_child_above(this.placeholder, actor);
        box.remove_child(actor);
        // It stands in for the actor: gone with the bar (as when the shell
        // shuts down), the actor goes too, as it would have in the bar
        this.placeholder.connectObject('destroy', () => {
            this.placeholder = null;
            actor.destroy();
        }, this);

        // The tile shows hover and an open menu like the dock's icons, the
        // indicator inside stays flat (see stylesheet.css)
        this._bin = new St.Bin({
            style_class: inTray ? 'bzd-tray-icon' : 'overview-icon',
            child: actor,
        });
        this.tile = new St.Bin({
            style_class: inTray ? 'bzd-tray-tile' : 'overview-tile bzd-edge-tile bzd-status-tile',
            reactive: true,
            track_hover: true,
            x_expand: false,
            y_expand: false,
            child: this._bin,
        });
        this.setSize(size);

        // Indicators are ButtonBoxes in a bin of their own
        this._button = actor instanceof St.Bin && actor.child instanceof PanelMenu.ButtonBox
            ? actor.child : null;
        const alert = alertClass(actor);
        if (alert)
            this.tile.add_style_class_name(alert);
        this._centerContent();
        this._placeMenu();

        const syncVisible = () => {
            this.tile.visible = actor.visible && (this._button?.visible ?? true);
        };
        actor.connectObject(
            'notify::visible', syncVisible,
            'parent-set', () => {
                if (actor.get_parent() !== this._bin)
                    this._lose(true);
            },
            'destroy', () => this._lose(false),
            this);
        this._button?.connectObject(
            'notify::visible', syncVisible,
            'menu-set', () => {
                // The old menu is destroyed by now
                this._unplaceMenu(false);
                this._placeMenu();
            },
            this);
        syncVisible();
    }

    // In the dock as wide as its icons, also when the indicator is wider
    // (its label then ends in "…"), so the dock never changes its width
    setSize(size) {
        if (!this.inTray)
            this._bin.style = `min-width: ${size}px; max-width: ${size}px;`;
    }

    // The indicator fills the tile, so all of it can be clicked; what it
    // shows sits in the middle
    _centerContent() {
        this._content = this._button?.get_first_child() ?? null;
        if (!this._content)
            return;
        this._contentAlign = this._content.x_align;
        this._content.x_align = Clutter.ActorAlign.CENTER;
        this._content.connectObject('destroy', () => (this._content = null), this);
    }

    _uncenterContent() {
        this._content?.disconnectObject(this);
        if (this._content)
            this._content.x_align = this._contentAlign;
        this._content = null;
    }

    // The menu opens next to the dock, and the tile stays lit while it is
    // open, like the dock's icons with their menus
    _placeMenu() {
        const menu = this._button?.menu;
        const boxPointer = menu?._boxPointer;
        if (!boxPointer)
            return;

        const arrowSide = boxPointer._arrowSide;
        boxPointer.updateArrowSide(this._side);
        const restorePlacement = placeNextToDock(boxPointer, () => ({
            dock: this._dockBackground,
            anchor: this.tile,
            margin: this._settings.get_int('popup-margin'),
        }));
        menu.connectObject('open-state-changed', (_menu, open) => {
            if (open)
                this.tile.hover = true;
            else
                this.tile.sync_hover();
        }, this);
        this._menu = {menu, boxPointer, arrowSide, restorePlacement};
    }

    _unplaceMenu(alive) {
        if (!this._menu)
            return;
        const {menu, boxPointer, arrowSide, restorePlacement} = this._menu;
        this._menu = null;
        menu.disconnectObject(this);
        restorePlacement();
        if (!alive)
            return;
        if (menu.isOpen)
            menu.close(BoxPointer.PopupAnimation.NONE);
        boxPointer.updateArrowSide(arrowSide);
    }

    _disconnect() {
        this._actor.disconnectObject(this);
        this._button?.disconnectObject(this);
    }

    // Back into the bar, at its placeholder
    restore() {
        this._disconnect();
        this._unplaceMenu(true);
        this._uncenterContent();
        this._bin.set_child(null);
        this.placeholder.get_parent().insert_child_above(this._actor, this.placeholder);
        this._destroy();
    }

    // Destroyed, or moved by someone else (GNOME puts its own indicators
    // back into the bar when the session mode changes)
    _lose(alive) {
        this._disconnect();
        this._unplaceMenu(alive);
        if (alive)
            this._uncenterContent();
        if (this._actor.get_parent() === this._bin)
            this._bin.set_child(null);
        this._destroy();
    }

    _destroy() {
        this._content?.disconnectObject(this);
        this._content = null;
        this.placeholder?.disconnectObject(this);
        this.placeholder?.destroy();
        this.tile.destroy();
    }
}

// The tile class of a warning (screen recording or sharing), or null
function alertClass(actor) {
    const button = actor instanceof St.Bin ? actor.child : null;
    const name = Object.keys(ALERTS).find(key => button?.has_style_class_name?.(key));
    return name ? ALERTS[name] : null;
}
