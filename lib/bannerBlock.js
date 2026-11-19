import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Whoever keeps banners back right now
const blockers = new Set();

/**
 * Keeps new notifications from popping up as banners while `owner` asks
 * for it (blocked true until false), as GNOME does while its calendar is
 * open: they go to the notification list, and those still to be shown pop
 * up once nobody blocks any more. For popups that sit where a banner would
 * show, or hold the notifications themselves. Several owners can block at
 * once without lifting each other's block.
 */
export function blockBanners(owner, blocked) {
    if (blocked)
        blockers.add(owner);
    else if (!blockers.delete(owner))
        return;
    Main.messageTray.bannerBlocked = blockers.size > 0;
}
