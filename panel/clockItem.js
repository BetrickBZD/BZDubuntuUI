import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';

/**
 * The clock in the dock, behind "Show Applications". Hover shows the
 * SystemStatus, left click opens calendar and notifications, right click
 * the quick settings (both normally hang off the hidden top bar).
 */
export const ClockItem = GObject.registerClass(
class ClockItem extends Dash.DashItemContainer {
    _init({dash, dockModules, clock, status}) {
        super._init();
        // Like the dock's own show-apps icon: never take the dock's free space
        this.x_expand = false;
        this.y_expand = false;

        this._status = status;
        const {AppIcons, Theming, Utils} = dockModules;
        this._showLabelImpl = AppIcons.itemShowLabel;
        this._side = Utils.getPosition();
        this.label?.add_style_class_name(Theming.PositionStyleClass[this._side]);

        const time = new St.Label({style_class: 'dock-clock-time'});
        this._button = new St.Button({
            style_class: 'dock-clock',
            track_hover: true,
            can_focus: true,
            button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE,
            child: time,
        });
        this.setChild(this._button);
        dash._hookUpLabel(this);

        const binding = clock.bind_property('clock', time, 'text', GObject.BindingFlags.SYNC_CREATE);

        this._button.connect('clicked', (_b, button) => {
            const {dateMenu, quickSettings} = Main.panel.statusArea;
            this._toggleMenu(button === Clutter.BUTTON_SECONDARY ? quickSettings : dateMenu);
        });
        this.connect('destroy', () => {
            binding.unbind();
            // Closing hands an opened menu back to the top bar
            const {dateMenu, quickSettings} = Main.panel.statusArea;
            for (const menu of [dateMenu?.menu, quickSettings?.menu]) {
                if (menu?.sourceActor === this._button)
                    menu.close();
            }
        });

        this.show(false);
    }

    showLabel() {
        this.setLabelText(this._status.describe());
        this._showLabelImpl.call(this);
    }

    // Open a top bar menu at the clock instead of the hidden bar, and hand it
    // back to the bar once it closes
    _toggleMenu(indicator) {
        const menu = indicator?.menu;
        if (!menu)
            return;

        if (!menu.isOpen) {
            const {sourceActor} = menu;
            menu.sourceActor = this._button;
            menu._boxPointer.updateArrowSide(this._side);
            menu.connectObject('open-state-changed', (_m, open) => {
                if (open)
                    return;
                menu.disconnectObject(this);
                menu.sourceActor = sourceActor;
                menu._boxPointer.updateArrowSide(St.Side.TOP);
            }, this);
        }
        menu.toggle();
    }
});
