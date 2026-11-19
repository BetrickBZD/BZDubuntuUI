import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {IllustratedSetting} from './preferences/illustratedSetting.js';
import {
    drawBadge, drawBannerPosition, drawCompactPanel, drawDockEnd, drawFisheye, drawFontSmoothing, drawGlass,
    drawMediaPopup, drawOverviewGlass, drawProgress, drawShine, drawUiStyle, drawUnifiedPanel, drawWallpaperTint,
} from './preferences/illustrations.js';
import {choiceRow, colorRow, dependsOn, scaleRow, switchRow} from './preferences/scaleRow.js';

// Icons to pick for "Show Applications": [setting value, shown icon, name]
const SHOW_APPS_ICONS = [
    ['', 'view-app-grid-ubuntu-symbolic', 'Original'],
    ['view-app-grid-symbolic', 'view-app-grid-symbolic', 'Raster'],
    ['view-grid-symbolic', 'view-grid-symbolic', 'Kacheln'],
    ['view-paged-symbolic', 'view-paged-symbolic', 'Seiten'],
    ['view-dual-symbolic', 'view-dual-symbolic', 'Spalten'],
    ['open-menu-symbolic', 'open-menu-symbolic', 'Menü'],
    ['view-more-symbolic', 'view-more-symbolic', 'Punkte'],
    ['start-here-symbolic', 'start-here-symbolic', 'Start'],
    ['system-search-symbolic', 'system-search-symbolic', 'Suche'],
    ['starred-symbolic', 'starred-symbolic', 'Stern'],
];

// Looks of "Show Applications" ('show-apps-style')
const SHOW_APPS_STYLES = [['pill', 'Pille'], ['grid', 'Groß'], ['thin', 'Punkte']];

// Kinds of glass ('glass-mode'), named like the choice in macOS
const GLASS_MODES = [['tinted', 'Getönt'], ['clear', 'Klar']];

/**
 * One page per module; further modules add their own page next to these.
 * Switches are illustrated cards like in GNOME Settings, other options
 * plain rows below them.
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

    popup.add(new IllustratedSetting({
        title: 'Hintergrund',
        subtitle: 'Hinter der Steuerung die Farbe des Covers, das Cover unscharf oder nichts',
        settings,
        key: 'media-background',
        choices: [['color', 'Farbe des Covers'], ['blur', 'Unscharfes Cover'], ['none', 'Ohne']],
        draw: drawMediaPopup,
    }));

    const progress = new Adw.PreferencesGroup({
        title: 'Fortschritt und Steuerung',
        description: 'Was Popup und Cover im Dock zeigen; die Vorschau zeigt die aktuelle Wahl',
    });
    page.add(progress);
    progress.add(new IllustratedSetting({
        title: 'Musik-Popup und Cover im Dock',
        subtitle: 'Fortschrittsring ums Cover, Balken in Cover-Farbe, Lautstärke und weicher Titelwechsel',
        settings,
        draw: drawProgress,
        rows: [
            switchRow(settings, 'dock-progress-ring', {
                title: 'Fortschrittsring im Dock',
                subtitle: 'Ein Ring um das Cover füllt sich mit dem Titel; pausiert wird das Cover abgedunkelt und zeigt ⏸',
            }),
            dependsOn(settings, 'dock-progress-ring', scaleRow(settings, 'dock-progress-ring-width', {
                title: 'Breite des Rings',
                format: value => `${value} px`,
            })),
            switchRow(settings, 'media-progress-color', {
                title: 'Balken in Cover-Farbe',
                subtitle: 'Fortschritts- und Lautstärkebalken in der kräftigen Farbe des Covers statt weiß',
            }),
            switchRow(settings, 'media-volume', {
                title: 'Lautstärke und Ausgabegerät',
                subtitle: 'Lautstärkeregler im Popup und ein Knopf, um zwischen Lautsprechern, Kopfhörern und Bluetooth zu wechseln',
            }),
            switchRow(settings, 'media-crossfade', {
                title: 'Weicher Titelwechsel',
                subtitle: 'Cover und Hintergrund blenden beim nächsten Titel weich über',
            }),
        ],
    }));

    const layout = new Adw.PreferencesGroup();
    page.add(layout);

    const margin = Adw.SpinRow.new_with_range(0, 64, 1);
    margin.set({
        title: 'Abstand',
        subtitle: 'Abstand der Popups zu Dock und Bildschirmrand in Pixeln',
    });
    settings.bind('popup-margin', margin, 'value', Gio.SettingsBindFlags.DEFAULT);
    layout.add(margin);

    const hideCard = new Adw.SwitchRow({
        title: 'Medienkarte im Benachrichtigungs-Popup ausblenden',
        subtitle: 'Der Player ist schon im Dock, GNOMEs eigene Karte über den Benachrichtigungen entfällt',
    });
    settings.bind('hide-panel-media', hideCard, 'active', Gio.SettingsBindFlags.DEFAULT);
    layout.add(hideCard);

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

    group.add(new IllustratedSetting({
        title: 'Kompakte Leiste',
        subtitle: 'Obere Leiste ausblenden und die Uhr unter „Anwendungen anzeigen“ zeigen; Datum, Akku und Benachrichtigungen beim Überfahren',
        settings,
        key: 'compact-panel',
        draw: drawCompactPanel,
    }));

    const statusIcons = new Adw.SwitchRow({
        title: 'Statussymbole im Dock',
        subtitle: 'Symbole von Apps (z. B. Discord), Bildschirmaufnahme und -freigabe, Tastaturlayout und andere Erweiterungen im Dock, nur solange sie aktiv sind',
    });
    settings.bind('compact-status-icons', statusIcons, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('compact-panel', statusIcons, 'sensitive', Gio.SettingsBindFlags.GET);
    const statusList = new Gtk.ListBox({
        css_classes: ['boxed-list'],
        selection_mode: Gtk.SelectionMode.NONE,
        margin_top: 12,
    });
    statusList.append(statusIcons);

    const collapse = new Adw.SwitchRow({
        title: 'Statussymbole einklappen',
        subtitle: 'Ein Knopf im Dock öffnet sie daneben; Bildschirmaufnahme und -freigabe bleiben immer sichtbar',
    });
    settings.bind('status-collapse', collapse, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('compact-status-icons', collapse, 'sensitive', Gio.SettingsBindFlags.GET);
    statusList.append(collapse);

    const swapClicks = new Adw.SwitchRow({
        title: 'Klicks an der Uhr tauschen',
        subtitle: 'Linksklick öffnet die Schnelleinstellungen, Rechtsklick Kalender und Benachrichtigungen',
    });
    settings.bind('clock-swap-clicks', swapClicks, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('compact-panel', swapClicks, 'sensitive', Gio.SettingsBindFlags.GET);
    statusList.append(swapClicks);
    group.add(statusList);

    // Everything at the dock's end in one card: its look shows live
    const end = new Adw.PreferencesGroup({title: 'Dock-Ende'});
    page.add(end);
    end.add(new IllustratedSetting({
        title: 'Pillen am Dock-Ende',
        subtitle: 'Uhr, Statusknopf › und „Anwendungen anzeigen“ auf runden Flächen, alle gleich breit wie das Cover darüber',
        settings,
        key: 'clock-pill',
        draw: drawDockEnd,
        rows: [
            choiceRow(settings, 'show-apps-style', SHOW_APPS_STYLES, {
                title: '„Anwendungen anzeigen“',
                subtitle: 'Raster auf einer Pille wie die anderen, großes Raster ohne Pille oder nur drei Punkte',
            }),
            dependsOn(settings, 'compact-panel', switchRow(settings, 'compact-battery', {
                title: 'Akku in der Uhr',
                subtitle: 'Akkustand unter der Uhrzeit; die Prozentzahl wie in GNOMEs Einstellungen unter Energie',
            })),
            dependsOn(settings, 'compact-battery', switchRow(settings, 'battery-colors', {
                title: 'Akku farbig',
                subtitle: 'Grün beim Laden, rot bei 20 % und weniger',
            })),
        ],
    }));

    const unified = new Adw.PreferencesGroup({title: 'Kontrollzentrum'});
    page.add(unified);
    unified.add(new IllustratedSetting({
        title: 'Alles in einem Panel',
        subtitle: 'Schnelleinstellungen, Benachrichtigungen und Kalender zusammen in einem Panel über die ganze Bildschirmhöhe, wie ein Kontrollzentrum; Klick auf die Uhr öffnet es',
        settings,
        key: 'unified-panel',
        draw: drawUnifiedPanel,
    }));

    const menus = new Adw.PreferencesGroup();
    page.add(menus);
    const shortcut = new Adw.SwitchRow({
        title: 'Einstellungs-Icon in den Schnelleinstellungen',
        subtitle: 'Puzzle-Icon neben Bildschirmfoto und Einstellungen, öffnet diese Einstellungen',
    });
    settings.bind('menu-settings-button', shortcut, 'active', Gio.SettingsBindFlags.DEFAULT);
    menus.add(shortcut);

    return page;
}

function appearancePage(settings, window) {
    const page = new Adw.PreferencesPage({
        title: 'Aussehen',
        icon_name: 'applications-graphics-symbolic',
    });

    const look = new Adw.PreferencesGroup({title: 'Stil'});
    page.add(look);
    look.add(new IllustratedSetting({
        title: 'Look',
        subtitle: 'One UI: Menüs, Popups, Kontrollzentrum und Musik-Player rund und kompakt wie bei One UI 9, mit Kacheln als Pillen, jedem Symbol in einem eigenen Kreis und schlanken Reglern. GNOME: wie bisher',
        settings,
        key: 'ui-style',
        choices: [['oneui', 'One UI'], ['standard', 'GNOME']],
        draw: drawUiStyle,
    }));
    look.add(new IllustratedSetting({
        title: 'Neue Benachrichtigungen',
        subtitle: 'Wo sie erscheinen: unten links neben dem Dock bei der Uhr oder oben. Oben in der Mitte verdecken sie ohne obere Leiste das Suchfeld der Übersicht',
        settings,
        key: 'banner-position',
        choices: [['bottom-start', 'Unten links'], ['start', 'Oben links'], ['center', 'Oben Mitte'], ['end', 'Oben rechts']],
        draw: drawBannerPosition,
    }));

    look.add(fontSmoothingCard(settings));

    const style = new Adw.PreferencesGroup({title: 'Liquid Glass'});
    page.add(style);

    style.add(new IllustratedSetting({
        title: 'Liquid Glass',
        subtitle: 'Dock, Popups und Fenster aus demselben Glas, das weichzeichnet, was dahinter liegt; hinter Popups auch Fenster, solange sie offen sind',
        settings,
        key: 'glass-style',
        draw: drawGlass,
        rows: [
            dependsOn(settings, 'glass-style', choiceRow(settings, 'glass-mode', GLASS_MODES, {
                title: 'Glas',
                subtitle: 'Getönt: Milchglas, ruhig und gut lesbar. Klar: wie bei macOS, das Hintergrundbild scheint deutlich durch',
            })),
            dependsOn(settings, 'glass-style', switchRow(settings, 'glass-live', {
                title: 'Live-Unschärfe',
                subtitle: 'Hinter Popups und Glas-Fenstern die Fenster dahinter weichzeichnen. Aus: nur das Hintergrundbild, spart Grafikleistung, wenn sich hinter einem Glas-Fenster viel bewegt'
            })),
            dependsOn(settings, 'glass-style', switchRow(settings, 'glass-everywhere', {
                title: 'Glas überall',
                subtitle: 'Auch alle anderen Oberflächen von GNOME: Menüs, Dialoge wie Ausschalten, Lautstärke- und Helligkeitsanzeige, Fensterwechsler',
            })),
            dependsOn(settings, 'glass-style', switchRow(settings, 'window-glass', {
                title: 'Fenster als Glas',
                subtitle: 'Nur GNOME-Apps wie Dateien, Einstellungen oder Texteditor: Ihr Hintergrund wird zu Glas, dahinter Hintergrundbild und Fenster weichgezeichnet; die Seitenleiste ist klarer als der Inhalt daneben, wie bei macOS. Text, Symbole und Bilder bleiben voll deckend. Apps mit eigenem Design bleiben unverändert',
            })),
            dependsOn(settings, 'window-glass', scaleRow(settings, 'window-glass-opacity', {
                title: 'Deckkraft der Fenster',
                subtitle: 'Weniger zeigt mehr Glas; Text und Symbole bleiben immer voll deckend',
                format: value => `${value} %`,
            })),
        ],
    }));

    const finish = new Adw.PreferencesGroup({
        title: 'Feinschliff',
        description: 'Wie das Glas aussieht; wirkt nur, wenn Liquid Glass an ist',
    });
    page.add(finish);
    const cards = [
        new IllustratedSetting({
            title: 'Lichtkante',
            subtitle: 'Wie bei Apples Liquid Glass fängt das Glas oben Licht: eine feine helle Kante und eine nach oben hin hellere Tönung',
            settings,
            draw: drawShine,
            rows: [scaleRow(settings, 'glass-shine', {
                title: 'Stärke',
                subtitle: '0 % schaltet die Lichtkante ab',
                step: 5,
                format: value => `${value} %`,
            })],
        }),
        new IllustratedSetting({
            title: 'Glas in der Farbe des Hintergrundbilds',
            subtitle: 'Das Glas nimmt einen Hauch der Farbe deines Hintergrundbilds an, statt neutral grau zu sein, und passt sich an, wenn du es wechselst',
            settings,
            key: 'glass-tint-wallpaper',
            draw: drawWallpaperTint,
            rows: [dependsOn(settings, 'glass-tint-wallpaper', scaleRow(settings, 'glass-tint-strength', {
                title: 'Stärke',
                format: value => `${value} %`,
            }))],
        }),
        new IllustratedSetting({
            title: 'Glas in der Übersicht',
            subtitle: 'Suchfeld, Suchergebnisse und App-Ordner der Übersicht als Glas',
            settings,
            key: 'glass-overview',
            draw: drawOverviewGlass,
        }),
    ];
    cards.forEach((card, i) => {
        card.margin_top = i ? 12 : 0;
        finish.add(dependsOn(settings, 'glass-style', card));
    });

    const zoom = new Adw.PreferencesGroup({title: 'Dock'});
    page.add(zoom);
    zoom.add(new IllustratedSetting({
        title: 'Zoom beim Überfahren',
        subtitle: 'Wie bei macOS wachsen die App-Icons zum Mauszeiger hin: das darunter am meisten, die Nachbarn weniger',
        settings,
        key: 'dock-magnify',
        draw: drawFisheye,
        rows: [
            dependsOn(settings, 'dock-magnify', scaleRow(settings, 'dock-magnify-zoom', {
                title: 'Vergrößerung',
                subtitle: 'Des Icons unter dem Mauszeiger',
                step: 5,
                format: value => `${value} %`,
            })),
            dependsOn(settings, 'dock-magnify', scaleRow(settings, 'dock-magnify-range', {
                title: 'Reichweite',
                subtitle: 'Wie viele Nachbar-Icons auf jeder Seite mitwachsen',
                format: value => (value === 1 ? '1 Icon' : `${value} Icons`),
            })),
        ],
    }));

    const customColor = colorRow(settings, 'dock-badge-color', {title: 'Eigene Farbe'});
    const syncCustom = () => (customColor.sensitive = settings.get_string('dock-badge-color-mode') === 'custom');
    settings.connect('changed::dock-badge-color-mode', syncCustom);
    syncCustom();
    const badges = new IllustratedSetting({
        title: 'Benachrichtigungs-Abzeichen',
        subtitle: 'Die Anzeige ungelesener Benachrichtigungen an App-Icons: als Zahl, als schlichter Punkt oder gar nicht',
        settings,
        key: 'dock-badge-style',
        choices: [['number', 'Zahl'], ['dot', 'Punkt'], ['hidden', 'Aus']],
        draw: drawBadge,
        rows: [
            choiceRow(settings, 'dock-badge-color-mode', [['theme', 'Standard'], ['accent', 'Akzent'], ['custom', 'Eigene']], {
                title: 'Farbe',
                subtitle: 'Die des Themes, deine Akzentfarbe oder eine eigene',
            }),
            customColor,
        ],
    });
    badges.margin_top = 12;
    zoom.add(badges);

    const launch = new Gtk.ListBox({
        css_classes: ['boxed-list'],
        selection_mode: Gtk.SelectionMode.NONE,
        margin_top: 12,
    });
    launch.append(switchRow(settings, 'dock-launch-feedback', {
        title: 'Icon hüpft beim Starten',
        subtitle: 'Wie bei macOS hüpft das Icon, bis das erste Fenster der App da ist; weitere Klicks währenddessen öffnen sie nicht noch einmal. Strg+Klick öffnet weiterhin bewusst ein neues Fenster',
    }));
    zoom.add(launch);

    const dock = new Adw.PreferencesGroup({
        title: '„Anwendungen anzeigen“-Icon',
        description: 'Eines auswählen, einen Icon-Namen aus dem Theme eingeben oder ein eigenes Bild wählen. Die Form (auf einer Pille, groß oder drei Punkte) steht unter Leiste → Dock-Ende',
    });
    page.add(dock);
    const picker = showAppsIconPicker(settings);
    const row = showAppsIconRow(settings, window);
    // The icon only shows with the grid
    const syncIcon = () => (picker.sensitive = row.sensitive = settings.get_string('show-apps-style') !== 'thin');
    settings.connect('changed::show-apps-style', syncIcon);
    syncIcon();
    dock.add(picker);
    dock.add(row);

    return page;
}

// The shell's font smoothing (a GNOME setting, not the extension's): text
// on glass gets colored fringes from subpixel smoothing, none in grayscale
function fontSmoothingCard(settings) {
    const iface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
    const row = new Adw.SwitchRow({
        title: 'Glatte Schrift',
        subtitle: 'Graustufen-Glättung statt Subpixel: kein farbiger Rand an Uhr und Text auf Glas. Gilt für das ganze System',
    });
    const sync = () => (row.active = iface.get_string('font-antialiasing') === 'grayscale');
    iface.connect('changed::font-antialiasing', sync);
    sync();
    row.connect('notify::active', () => {
        const value = row.active ? 'grayscale' : 'rgba';
        if (iface.get_string('font-antialiasing') !== value)
            iface.set_string('font-antialiasing', value);
    });
    return new IllustratedSetting({
        title: 'Schrift auf Glas',
        subtitle: 'Wie Text auf durchscheinenden Flächen geglättet wird',
        settings,
        draw: drawFontSmoothing,
        rows: [row],
        redrawOn: [iface],
    });
}

// One toggle button per icon in SHOW_APPS_ICONS; none is active while a
// custom icon is set
function showAppsIconPicker(settings) {
    const flow = new Gtk.FlowBox({
        selection_mode: Gtk.SelectionMode.NONE,
        homogeneous: true,
        max_children_per_line: SHOW_APPS_ICONS.length,
        column_spacing: 6,
        row_spacing: 6,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 8,
        margin_end: 8,
    });

    let group = null;
    const buttons = SHOW_APPS_ICONS.map(([value, iconName, name]) => {
        const button = new Gtk.ToggleButton({
            child: new Gtk.Image({icon_name: iconName, pixel_size: 24}),
            tooltip_text: name,
            css_classes: ['flat'],
            group,
        });
        group ??= button;
        button.connect('toggled', () => {
            if (button.active && settings.get_string('show-apps-icon') !== value)
                settings.set_string('show-apps-icon', value);
        });
        flow.append(button);
        return [value, button];
    });

    const sync = () => {
        const current = settings.get_string('show-apps-icon');
        for (const [value, button] of buttons)
            button.active = value === current;
    };
    settings.connect('changed::show-apps-icon', sync);
    sync();

    const card = new Gtk.Box({css_classes: ['card'], margin_bottom: 12});
    card.append(flow);
    return card;
}

function showAppsIconRow(settings, window) {
    const row = new Adw.EntryRow({
        title: 'Icon',
        text: settings.get_string('show-apps-icon'),
        show_apply_button: true,
    });
    row.connect('apply', () => settings.set_string('show-apps-icon', row.text.trim()));
    settings.connect('changed::show-apps-icon', () => {
        row.text = settings.get_string('show-apps-icon');
    });

    const choose = new Gtk.Button({
        icon_name: 'document-open-symbolic',
        tooltip_text: 'Bild auswählen',
        valign: Gtk.Align.CENTER,
        css_classes: ['flat'],
    });
    choose.connect('clicked', () => {
        const filter = new Gtk.FileFilter({name: 'Bilder'});
        filter.add_pixbuf_formats();
        filter.add_mime_type('image/svg+xml');
        const dialog = new Gtk.FileDialog({title: 'Icon auswählen', default_filter: filter});
        dialog.open(window, null, (_d, result) => {
            try {
                settings.set_string('show-apps-icon', dialog.open_finish(result).get_path());
            } catch {
                // Dialog cancelled
            }
        });
    });
    row.add_suffix(choose);

    const reset = new Gtk.Button({
        icon_name: 'edit-undo-symbolic',
        tooltip_text: 'Original wiederherstellen',
        valign: Gtk.Align.CENTER,
        css_classes: ['flat'],
    });
    reset.connect('clicked', () => settings.reset('show-apps-icon'));
    row.add_suffix(reset);

    return row;
}

export default class DockMediaPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.add(mediaPage(settings));
        window.add(panelPage(settings));
        window.add(appearancePage(settings, window));
    }
}
