import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Takes GNOME's own media card out of the notification list, as the dock
 * shows the player already. Done the list's own way: it stops listening
 * for players and removes their cards, so its "no notifications" state
 * stays right. destroy() lets it listen again, which brings the cards of
 * running players back.
 */
export class PanelMediaHider {
    constructor() {
        const view = Main.panel.statusArea.dateMenu?._messageList?._messageView;
        // Internals of GNOME Shell: leave the list alone if they changed
        if (!view?._mediaSource || !(view._playerToMessage instanceof Map) ||
            typeof view._setupMpris !== 'function') {
            this._view = null;
            return;
        }

        this._view = view;
        view._mediaSource.disconnectObject(view);
        for (const player of [...view._playerToMessage.keys()])
            view._removePlayer(player);
    }

    destroy() {
        this._view?._setupMpris();
        this._view = null;
    }
}
