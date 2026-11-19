import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {blockBanners} from '../lib/bannerBlock.js';

import {openQuickSettings} from './barMenu.js';

/**
 * Quick settings, notifications and calendar in one panel the whole height
 * of the screen ('unified-panel'), like a control center: the calendar
 * menu's content (notifications and the calendar column) is lent to the
 * quick settings menu, below the toggles, laid out top to bottom. The quick
 * settings themselves stay as they are, so their menus (power, Wi-Fi …)
 * keep working. Whatever opens the calendar opens the panel instead, and
 * activating a notification closes it like the calendar would. Everything
 * goes back on destroy(). The calendar's events, world clocks and weather
 * and the date above it are left out for the notifications to have room.
 */
export class UnifiedPanel {
    constructor(settings) {
        this._settings = settings;
        const {dateMenu, quickSettings} = Main.panel.statusArea;
        this._dateMenu = dateMenu;
        this._quick = quickSettings?.menu ?? null;
        // The calendar menu's only child: notifications | calendar column
        this._content = dateMenu?.menu.box.get_first_child() ?? null;
        this._messages = dateMenu?._messageList ?? null;
        this._columns = this._messages?.get_parent() ?? null;
        // The calendar column, after the notifications
        this._calendarColumn = this._columns?.get_last_child() ?? null;
        if (!this._quick || !this._content || !this._columns) {
            this._quick = null;
            return;
        }

        this._saved = {
            orientation: this._columns.orientation,
            contentExpand: this._content.y_expand,
            columnsExpand: this._columns.y_expand,
            messagesExpand: this._messages.y_expand,
            calendarExpand: this._calendarColumn?.y_expand,
        };
        dateMenu.menu.close(BoxPointer.PopupAnimation.NONE);
        this._quick.close(BoxPointer.PopupAnimation.NONE);
        dateMenu.menu.box.remove_child(this._content);
        // An empty menu doesn't open at all, and then can't hand over to
        // the panel: an invisible stand-in keeps it opening
        this._standIn = new St.Widget();
        dateMenu.menu.box.add_child(this._standIn);
        this._quick.box.add_child(this._content);
        // The notifications take the room left, the calendar only its own
        this._columns.orientation = Clutter.Orientation.VERTICAL;
        this._content.y_expand = this._columns.y_expand = this._messages.y_expand = true;
        if (this._calendarColumn)
            this._calendarColumn.y_expand = false;
        // Below the month the calendar column has events, world clocks and
        // weather; with them it would leave the notifications no room, so
        // they stay out of the panel. GNOME shows them again on session
        // changes (screen lock), so they are hidden again then
        this._displays = dateMenu._displaysSection ?? null;
        this._displays?.connectObject('notify::visible', () => {
            if (this._displays.visible)
                this._displays.hide();
        }, this);
        this._displays?.hide();
        // The date above the month is already the clock's: left out too
        this._today = dateMenu._date ?? null;
        this._today?.connectObject('notify::visible', () => {
            if (this._today.visible)
                this._today.hide();
        }, this);
        this._today?.hide();
        // The panel is wider than the calendar: centered in its card
        this._centered = [dateMenu._date, dateMenu._calendar].filter(Boolean)
            .map(actor => [actor, actor.x_align]);
        for (const [actor] of this._centered)
            actor.x_align = Clutter.ActorAlign.CENTER;
        this._addHeading();
        this._quick.box.add_style_class_name('bzd-unified-panel');
        // When the session ends GNOME destroys its menus before the
        // extension: then there is nothing left to give back, nor to size
        // when the panel's removal changes the work area meanwhile
        this._gone = false;
        this._watched = [this._quick.box, this._quick._boxPointer, dateMenu.menu.box, this._content, this._messages]
            .filter(Boolean);
        for (const actor of this._watched)
            actor.connectObject('destroy', () => this._markGone(), this);

        this._quick.connectObject('open-state-changed', (_m, open) => this._onOpenChanged(open), this);
        // Like in the calendar menu: a click elsewhere collapses an
        // expanded notification group
        this._quick.actor.connectObject(
            'captured-event::button', (_a, event) => dateMenu._messageList.maybeCollapseMessageGroupForEvent(event),
            'captured-event::touch', (_a, event) => dateMenu._messageList.maybeCollapseMessageGroupForEvent(event),
            this);
        // Whatever opens the calendar's menu (its clock in the top bar, a
        // shortcut) gets the panel; only once the menu manager is done with
        // the calendar menu, which it would otherwise close the panel for
        this._openId = 0;
        dateMenu.menu.connectObject('open-state-changed', (menu, open) => {
            if (!open || this._openId)
                return;
            menu.close(BoxPointer.PopupAnimation.NONE);
            this._openId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this._openId = 0;
                if (!this._quick.isOpen)
                    openQuickSettings();
                return GLib.SOURCE_REMOVE;
            });
        }, this);

        // Sized ahead of opening: setting it while the menu opens gave
        // its submenu layer no valid place for the first frame
        this._focusId = 0;
        global.display.connectObject('workareas-changed', () => this._fitHeight(), this);
        settings.connectObject('changed::popup-margin', () => this._fitHeight(), this);
        this._watchSubmenus();
        this._fitHeight();
    }

    // The notifications get a heading, with GNOME's "Clear" button moved
    // up next to it from below the list, shown only when there is
    // something to clear (it is otherwise left greyed out)
    _addHeading() {
        const clear = this._messages._clearButton;
        this._controls = clear?.get_parent() ?? null;
        this._listBox = this._controls?.get_parent() ?? null;
        if (!this._controls || !this._listBox)
            return;

        this._heading = new St.Label({
            style_class: 'bzd-panel-heading',
            text: 'Benachrichtigungen',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._controls.insert_child_at_index(this._heading, 0);
        this._listBox.set_child_at_index(this._controls, 0);
        this._savedClear = {x_expand: clear.x_expand, x_align: clear.x_align};
        clear.set({x_expand: false, x_align: Clutter.ActorAlign.END});
        const sync = () => (clear.opacity = clear.reactive ? 255 : 0);
        clear.connectObject('notify::reactive', sync, this);
        sync();
    }

    _removeHeading() {
        if (!this._heading)
            return;
        const clear = this._messages._clearButton;
        clear.disconnectObject(this);
        clear.set({...this._savedClear, opacity: 255});
        this._heading.destroy();
        this._heading = null;
        this._listBox.set_child_at_index(this._controls, this._listBox.get_n_children() - 1);
    }

    _onOpenChanged(open) {
        // Like while the calendar is open: new notifications go to the
        // list, no banner pops up next to or under the panel
        blockBanners(this, open);
        if (!open) {
            this._disconnectFocus();
            return;
        }

        // Toggles may have come or gone since (VPN, Bluetooth …)
        this._fitHeight();

        // Like the calendar menu does on opening: show today
        const now = new Date();
        this._dateMenu._calendar?.setDate(now);
        this._dateMenu._date?.setDate(now);
        this._dateMenu._eventsItem?.setDate(now);

        // Activating a notification brings up its app, which closes the
        // calendar menu; the panel closes with the app getting the focus
        this._disconnectFocus();
        this._focusId = global.display.connect('notify::focus-window', () => {
            if (global.display.focus_window)
                this._quick.close();
        });
    }

    _disconnectFocus() {
        if (this._focusId)
            global.display.disconnect(this._focusId);
        this._focusId = 0;
    }

    // A menu of the quick settings (power, Wi-Fi …) pushes everything below
    // the toggles down by its height while it is open, growing frame by
    // frame as it opens: the notifications give up that height at once, in
    // the same frame, or the panel would grow past the screen and be
    // pushed up out of it. The menus are the children of the quick
    // settings' overlay, their fixed height is what animates; that, unlike
    // their 'height', doesn't change during layout, which must not be
    // changed from
    _watchSubmenus() {
        const overlay = this._quick._overlay;
        if (!overlay)
            return;
        const watch = menu => menu.connectObject(
            'notify::natural-height', () => this._fitHeight(),
            'notify::natural-height-set', () => this._fitHeight(),
            this);
        overlay.connectObject('child-added', (_o, menu) => watch(menu), this);
        overlay.get_children().forEach(watch);
        this._overlay = overlay;
    }

    _unwatchSubmenus() {
        if (!this._overlay)
            return;
        this._overlay.disconnectObject(this);
        for (const menu of this._overlay.get_children())
            menu.disconnectObject(this);
        this._overlay = null;
    }

    // Exactly the whole height of the work area, less the popup margin on
    // both ends and what the box pointer adds around the box. Squeezing the
    // content into it would hand some of GNOME's actors invalid sizes, so
    // instead the notifications get exactly the height left over and
    // scroll within, down to none at all while a tall menu is open. From
    // the preferred sizes, so it works while closed; on the primary
    // monitor, the dock's
    _fitHeight() {
        if (this._gone || !this._quick)
            return;
        const box = this._quick.box;
        const pointer = this._quick._boxPointer;
        const work = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        if (!work)
            return;

        this._messages.natural_height_set = false;
        this._messages.min_height_set = false;
        const [, width] = box.get_preferred_width(-1);
        const [, pointerHeight] = pointer.get_preferred_height(-1);
        const [, boxHeight] = box.get_preferred_height(width);
        const [, messagesHeight] = this._messages.get_preferred_height(width);
        const margin = this._settings.get_int('popup-margin');
        const available = work.height - 2 * margin - (pointerHeight - boxHeight);
        const rest = boxHeight - messagesHeight;
        this._messages.height = Math.max(0, Math.floor(available - rest));
    }

    // Nothing reacts any more: what it would act on is going
    _markGone() {
        this._gone = true;
        if (this._openId)
            GLib.source_remove(this._openId);
        this._openId = 0;
        this._disconnectFocus();
        global.display.disconnectObject(this);
        this._settings.disconnectObject(this);
    }

    destroy() {
        if (!this._quick)
            return;
        const gone = this._gone;
        this._markGone();
        if (gone) {
            this._quick = null;
            return;
        }
        for (const actor of this._watched)
            actor.disconnectObject(this);
        this._unwatchSubmenus();
        this._quick.disconnectObject(this);
        blockBanners(this, false);
        this._quick.actor.disconnectObject(this);
        this._dateMenu.menu.disconnectObject(this);
        this._quick.close(BoxPointer.PopupAnimation.NONE);

        this._quick.box.remove_child(this._content);
        this._standIn.destroy();
        this._dateMenu.menu.box.insert_child_at_index(this._content, 0);
        this._columns.orientation = this._saved.orientation;
        this._content.y_expand = this._saved.contentExpand;
        this._columns.y_expand = this._saved.columnsExpand;
        this._messages.y_expand = this._saved.messagesExpand;
        if (this._calendarColumn)
            this._calendarColumn.y_expand = this._saved.calendarExpand;
        this._removeHeading();
        for (const [actor, align] of this._centered)
            actor.x_align = align;
        this._today?.disconnectObject(this);
        this._today?.show();
        this._displays?.disconnectObject(this);
        if (this._displays)
            this._displays.visible = Main.sessionMode.allowSettings;
        this._quick.box.remove_style_class_name('bzd-unified-panel');
        this._messages.height = -1;
        this._quick = null;
    }
}
