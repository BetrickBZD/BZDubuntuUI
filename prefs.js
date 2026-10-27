import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/**
 * One page per module; further modules add their own page next to this one.
 */
function mediaPage(settings) {
    const page = new Adw.PreferencesPage({
        title: 'Medien',
        icon_name: 'audio-x-generic-symbolic',
    });

    const popup = new Adw.PreferencesGroup({
        title: 'Popup',
        description: 'Steuerung, die sich beim Klick auf das Cover im Dock öffnet',
    });
    page.add(popup);

    const blur = new Adw.SwitchRow({
        title: 'Unscharfer Hintergrund',
        subtitle: 'Album-Cover unscharf hinter der Steuerung anzeigen',
    });
    settings.bind('blur-background', blur, 'active', Gio.SettingsBindFlags.DEFAULT);
    popup.add(blur);

    const margin = Adw.SpinRow.new_with_range(0, 64, 1);
    margin.set({
        title: 'Abstand',
        subtitle: 'Abstand zu Dock und Bildschirmrand in Pixeln',
    });
    settings.bind('popup-margin', margin, 'value', Gio.SettingsBindFlags.DEFAULT);
    popup.add(margin);

    return page;
}

function panelPage(settings) {
    const page = new Adw.PreferencesPage({
        title: 'Leiste',
        icon_name: 'preferences-desktop-display-symbolic',
    });

    const group = new Adw.PreferencesGroup({
        title: 'Obere Leiste',
        description: 'Kalender per Linksklick, Schnelleinstellungen per Rechtsklick auf die Uhr',
    });
    page.add(group);

    const compact = new Adw.SwitchRow({
        title: 'Kompakte Leiste',
        subtitle: 'Obere Leiste ausblenden und die Uhr unter „Anwendungen anzeigen“ zeigen; Datum, Akku und Benachrichtigungen beim Überfahren',
    });
    settings.bind('compact-panel', compact, 'active', Gio.SettingsBindFlags.DEFAULT);
    group.add(compact);

    return page;
}

export default class DockMediaPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.add(mediaPage(settings));
        window.add(panelPage(settings));
    }
}
