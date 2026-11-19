import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {placeNextToDock} from '../lib/dockPlacement.js';

// The button points to where the popup opens: away from the dock's edge
const CHEVRONS = {
    [St.Side.LEFT]: 'pan-end-symbolic',
    [St.Side.RIGHT]: 'pan-start-symbolic',
    [St.Side.TOP]: 'pan-down-symbolic',
    [St.Side.BOTTOM]: 'pan-up-symbolic',
};

/**
 * Status icons that needn't be seen all the time, behind one button in the
 * dock, like the hidden icons of other desktops: a click opens them in a
 * small popup next to the dock (`box`). Like GNOME's menus it takes the
 * input while open, so a click anywhere else (also on a window) or Escape
 * closes it; the icons' own menus open on top of it as usual (`place`:
 * next to the popup).
 */
export class StatusTray {
    constructor({side, dockBackground, settings}) {
        this._icon = new St.Bin({
            style_class: 'overview-icon',
            child: new St.Icon({icon_name: CHEVRONS[side]}),
        });
        this.button = new St.Button({
            style_class: 'overview-tile bzd-edge-tile bzd-status-tile bzd-tray-button',
            track_hover: true,
            can_focus: true,
            x_expand: false,
            y_expand: false,
            visible: false,
            accessible_name: 'Weitere Symbole',
            child: this._icon,
        });
        this.button.connect('clicked', () => this.toggle());
        // On a pill like the clock below it ('clock-pill')
        this._settings = settings;
        const syncPill = () => {
            if (settings.get_boolean('clock-pill'))
                this.button.add_style_class_name('bzd-dock-pill');
            else
                this.button.remove_style_class_name('bzd-dock-pill');
        };
        settings.connectObject('changed::clock-pill', syncPill, this);
        syncPill();

        this.box = new St.BoxLayout({style_class: 'popup-menu-content bzd-tray'});
        this._boxPointer = new BoxPointer.BoxPointer(side);
        this._boxPointer.style_class = 'popup-menu-boxpointer';
        // Like GNOME's menus: only then it gets the keys while open
        this._boxPointer.reactive = true;
        this._boxPointer.bin.set_child(this.box);
        this._boxPointer.connect('destroy', () => (this._boxPointer = null));
        Main.layoutManager.addTopChrome(this._boxPointer);
        this._boxPointer.hide();
        this._restorePlacement = placeNextToDock(this._boxPointer, () => ({
            dock: dockBackground,
            anchor: this.button,
            margin: settings.get_int('popup-margin'),
            // Hardly bigger than the button: level with it
            center: true,
        }));

        this.place = {side, dockBackground: this._boxPointer, settings};
        this.isOpen = false;
        this._grab = null;
    }

    // As wide as the dock's icons, like the other tiles
    setSize(size) {
        this._icon.style = `min-width: ${size}px; max-width: ${size}px;`;
    }

    // The button shows only while there is something behind it
    setHasIcons(hasIcons) {
        this.button.visible = hasIcons;
        if (!hasIcons)
            this.close();
    }

    toggle() {
        if (this.isOpen)
            this.close();
        else
            this.open();
    }

    open() {
        if (this.isOpen || !this._boxPointer)
            return;
        this.isOpen = true;
        this.button.checked = true;
        this._boxPointer.setPosition(this.button, 0.5);
        this._boxPointer.open(BoxPointer.PopupAnimation.FULL);
        this._grab = Main.pushModal(this._boxPointer, {actionMode: Shell.ActionMode.POPUP});
        this._boxPointer.connectObject('captured-event', (_actor, event) => {
            const type = event.type();
            if (type === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_Escape) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            // Also on the button: that closes it, like a second click
            if ((type === Clutter.EventType.BUTTON_PRESS || type === Clutter.EventType.TOUCH_BEGIN) &&
                !this._boxPointer.contains(global.stage.get_event_actor(event))) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }, this);
    }

    close(animation = BoxPointer.PopupAnimation.FULL) {
        if (!this.isOpen)
            return;
        this.isOpen = false;
        this._boxPointer?.disconnectObject(this);
        if (this._grab)
            Main.popModal(this._grab);
        this._grab = null;
        this.button.checked = false;
        this._boxPointer?.close(animation);
    }

    // The icons in the popup have to be taken out before
    destroy() {
        this._settings.disconnectObject(this);
        this.close(BoxPointer.PopupAnimation.NONE);
        this._restorePlacement();
        if (this._boxPointer) {
            Main.layoutManager.removeChrome(this._boxPointer);
            this._boxPointer.destroy();
        }
    }
}
