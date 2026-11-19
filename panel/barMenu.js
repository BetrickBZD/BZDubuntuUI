import St from 'gi://St';

import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {placeNextToDock} from '../lib/dockPlacement.js';

// Menus at a dock button -> how to hand them back to the bar
const borrowed = new Map();

/**
 * Buttons in the dock that open the bar's menus (the clock), each with how
 * to open the quick settings at it: while the top bar is hidden, a menu
 * opened elsewhere (a shortcut) has to open at one of them.
 */
export const barMenuButtons = new Map(); // button -> open quick settings there

// The quick settings at a mapped dock button, or at the bar if none
export function openQuickSettings() {
    for (const [button, open] of barMenuButtons) {
        if (button.mapped) {
            open();
            return;
        }
    }
    Main.panel.statusArea.quickSettings?.menu.open(BoxPointer.PopupAnimation.FULL);
}

/**
 * Opens or closes a menu of the hidden top bar (calendar, quick settings)
 * at a button in the dock instead, placed like the media popup. The menu
 * goes back to the bar only once its close animation is over
 * ('menu-closed'): doing it earlier made the closing menu jump to the
 * hidden bar at the top. owner is the dock item the button belongs to.
 */
export function toggleBarMenu(menu, {owner, button, side, dockBackground, settings}) {
    if (!menu)
        return;

    // Still ours if reopened during the close animation
    if (menu.sourceActor !== button) {
        const {sourceActor} = menu;
        menu.sourceActor = button;
        menu._boxPointer.updateArrowSide(side);
        const restorePlacement = placeNextToDock(menu._boxPointer, () => ({
            dock: dockBackground,
            anchor: button,
            margin: settings.get_int('popup-margin'),
        }));
        const giveBack = () => {
            borrowed.delete(menu);
            menu.disconnectObject(owner);
            menu.sourceActor = sourceActor;
            menu._boxPointer.updateArrowSide(St.Side.TOP);
            restorePlacement();
        };
        borrowed.set(menu, giveBack);
        menu.connectObject('menu-closed', () => {
            if (!menu.isOpen)
                giveBack();
        }, owner);
    }
    menu.toggle();
}

// Hands a menu opened at the button back to the bar at once, for a button
// that goes away: a close animation would still follow it. Also when its
// 'menu-closed' handler went with the dock item: otherwise the menu kept
// the destroyed button as its source
export function closeBarMenus(button) {
    const {dateMenu, quickSettings} = Main.panel.statusArea;
    for (const menu of [dateMenu?.menu, quickSettings?.menu]) {
        if (menu?.sourceActor !== button)
            continue;
        menu.close(BoxPointer.PopupAnimation.NONE);
        borrowed.get(menu)?.();
    }
}
