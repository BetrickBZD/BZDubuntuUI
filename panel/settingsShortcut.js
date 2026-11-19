import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * A puzzle icon in the quick settings' row of round buttons, left of
 * screenshot and settings, that opens this extension's preferences.
 * Styled like its neighbours (icon-button); removed again on destroy().
 */
export class SettingsShortcut {
    constructor(openPreferences) {
        this._openPreferences = openPreferences;
        this._button = null;
        this._menu = Main.panel.statusArea.quickSettings?.menu ?? null;

        // GNOME builds that row asynchronously after login, so if it isn't
        // there yet the icon goes in when the menu opens
        this._menu?.connectObject('open-state-changed', (_m, open) => {
            if (open)
                this._insert();
        }, this);
        this._insert();
    }

    _insert() {
        const row = Main.panel.statusArea.quickSettings?._system?._systemItem?.child;
        if (this._button || !row)
            return;

        this._button = new St.Button({
            style_class: 'icon-button',
            can_focus: true,
            accessible_name: 'BZDubuntuUI-Einstellungen',
            child: new St.Icon({icon_name: 'application-x-addon-symbolic'}),
        });
        this._button.connect('clicked', () => {
            this._menu?.close();
            this._openPreferences();
        });
        this._button.connect('destroy', () => (this._button = null));

        // The row also holds plain Clutter.Actor spacers without style classes
        const firstButton = row.get_children().find(child =>
            child instanceof St.Widget && child.has_style_class_name('icon-button'));
        if (firstButton)
            row.insert_child_below(this._button, firstButton);
        else
            row.add_child(this._button);
    }

    destroy() {
        this._menu?.disconnectObject(this);
        this._menu = null;
        this._button?.destroy();
    }
}
