import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const GAP = 8;        // px between dock item and label, and to screen edges
const SLIDE = 6;      // px the label glides out from the dock
const DURATION = 180; // ms

/**
 * Shows a dock item's hover label (Dash.DashItemContainer) next to it, for
 * the items this extension adds. Unlike the dock's own version it keeps the
 * whole label on screen also vertically, so multi-line labels at the
 * bottom of a side dock aren't cut off, rounds it like the popups instead
 * of a pill, and lets it glide out from the dock while fading in. Hiding is
 * left to the dock (DashItemContainer.hideLabel()).
 */
export function showDockLabel(item, side) {
    const {label} = item;
    if (!item._labelText || !label?.get_stage())
        return;

    label.set_text(item._labelText);
    label.add_style_class_name('bzd-dock-label');
    if (item._labelText.includes('\n'))
        label.add_style_class_name('bzd-dock-label-list');
    else
        label.remove_style_class_name('bzd-dock-label-list');
    label.remove_all_transitions();
    label.show();

    const [itemX, itemY] = item.get_transformed_position();
    const [itemWidth, itemHeight] = item.get_transformed_size();
    const [, , width, height] = label.get_preferred_size();
    const centerX = itemX + (itemWidth - width) / 2;
    const centerY = itemY + (itemHeight - height) / 2;

    // Position next to the item and the direction it glides out to
    let x, y, slideX = 0, slideY = 0;
    switch (side) {
    case St.Side.RIGHT:
        [x, y, slideX] = [itemX - width - GAP, centerY, SLIDE];
        break;
    case St.Side.TOP:
        [x, y, slideY] = [centerX, itemY + itemHeight + GAP, -SLIDE];
        break;
    case St.Side.BOTTOM:
        [x, y, slideY] = [centerX, itemY - height - GAP, SLIDE];
        break;
    default:
        [x, y, slideX] = [itemX + itemWidth + GAP, centerY, -SLIDE];
    }

    const monitor = Main.layoutManager.findMonitorForActor(item);
    if (monitor) {
        x = Math.clamp(x, monitor.x + GAP, monitor.x + monitor.width - width - GAP);
        y = Math.clamp(y, monitor.y + GAP, monitor.y + monitor.height - height - GAP);
    }

    label.set_position(Math.round(x), Math.round(y));
    label.set({opacity: 0, translation_x: slideX, translation_y: slideY});
    label.ease({
        opacity: 255,
        translation_x: 0,
        translation_y: 0,
        duration: DURATION,
        mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
    });
}
