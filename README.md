# Dock Media

GNOME-Shell-Erweiterung, die das Album-Cover des gerade laufenden Media-Players direkt im Ubuntu Dock bzw. Dash to Dock anzeigt – neben dem Button „Anwendungen anzeigen“.

- **Hover** zeigt Titel und Interpret (mit ⏸, wenn pausiert)
- **Linksklick** öffnet ein kompaktes Popup mit Cover, Titel und Wiedergabe-Steuerung
- **Mittelklick** schaltet Play/Pause um
- **Scrollen** springt zum vorherigen (hoch) bzw. nächsten (runter) Titel

## Voraussetzungen

- GNOME Shell **50**
- [Ubuntu Dock](https://launchpad.net/ubuntu/+source/gnome-shell-extension-ubuntu-dock) (`ubuntu-dock@ubuntu.com`) **oder** [Dash to Dock](https://extensions.gnome.org/extension/307/dash-to-dock/) (`dash-to-dock@micxgx.gmail.com`)
- Ein Player mit MPRIS-Unterstützung (z. B. Spotify, Firefox, Rhythmbox, VLC, …)

Ohne aktives Dock bleibt die Erweiterung inaktiv. Wird das Dock später aktiviert oder neu geladen, hängt sie sich automatisch wieder ein.

## Installation

```bash
git clone https://github.com/BetrickBZD/BZDubuntuUI.git ~/.local/share/gnome-shell/extensions/dock-media@yekda
```

Anschließend GNOME Shell neu starten (unter Wayland: ab- und wieder anmelden) und die Erweiterung aktivieren:

```bash
gnome-extensions enable dock-media@yekda
```

## Funktionsweise

### Player-Auswahl

Die Erweiterung beobachtet alle MPRIS-Player über `Mpris.MprisSource` aus GNOME Shell. Angezeigt wird in dieser Reihenfolge:

1. ein im Popup manuell gewählter Player (solange er existiert)
2. ein Player, der gerade abspielt
3. der zuletzt angezeigte Player
4. Spotify, falls vorhanden
5. sonst der erste verfügbare Player

Gibt es keinen Player, wird das Dock-Icon ausgeblendet. Laufen mehrere Player, lässt sich im Popup zwischen ihnen wechseln.

### Cover-Cache

Lokale Cover (`file://…` oder absolute Pfade) werden direkt verwendet. Cover aus dem Netz werden per libsoup geladen und unter

```
~/.cache/dock-media/<sha1 der URL>
```

gespeichert. Der Cache wird nicht automatisch geleert; bei Bedarf kann das Verzeichnis gefahrlos gelöscht werden.

## Einstellungen

Erreichbar über das Zahnrad oben rechts im Popup oder mit `gnome-extensions prefs dock-media@yekda`.

| Einstellung | Schlüssel | Standard |
|---|---|---|
| Unscharfer Hintergrund | `blur-background` | an |
| Abstand zu Dock und Bildschirmrand (px) | `popup-margin` | 5 |
| Kompakte Leiste | `compact-panel` | aus |

Änderungen wirken sofort, ohne Neuanmeldung.

## Projektstruktur

| Datei | Inhalt |
|---|---|
| `metadata.json` | UUID, Name, Beschreibung, unterstützte Shell-Version |
| `extension.js` | Einstiegspunkt; startet und beendet die Module |
| `prefs.js` | Einstellungsfenster, eine Seite pro Modul (bisher „Medien“) |
| `stylesheet.css` | Styles für Dock-Icon und Popup |
| `schemas/` | GSettings-Schema `org.gnome.shell.extensions.dock-media` |
| `lib/` | gemeinsame Bausteine für alle Module |
| `media/` | Medien-Modul |
| `panel/` | Leisten-Modul |

Nach Änderungen am Schema neu kompilieren:

```bash
glib-compile-schemas schemas/
```

### Aufbau

```
DockMediaExtension (extension.js)
└── MediaModule (media/module.js)                erbt von Module (lib/module.js)
    ├── MediaController (media/controller.js)    Modell: Player, Cover, Cache
    └── DockConnector (lib/dockConnector.js)     ein Element pro Dock
        └── DockMediaItem (media/dockItem.js)    Ansicht im Dock
            ├── CoverView (media/coverView.js)
            └── MediaMenu (media/menu.js)        Ansicht als Popup
                └── CoverView
└── PanelModule (panel/module.js)                erbt von Module
    └── CompactPanel (panel/compactPanel.js)     nur bei „Kompakte Leiste“
        ├── SystemStatus (panel/systemStatus.js) Datum, Akku, Benachrichtigungen
        └── DockConnector                        ein Element pro Dock
            └── ClockItem (panel/clockItem.js)   Uhr unter „Anwendungen anzeigen“
```

- **`lib/`** enthält Bausteine, die jedes Modul nutzen kann:
  - `Module` ist die Basisklasse: Ein Modul startet im Konstruktor, räumt in `destroy()` alles wieder auf und hat Zugriff auf die Einstellungen (`this.settings`) und `openPreferences()`.
  - `DockConnector` hängt sich in Ubuntu Dock bzw. Dash to Dock ein (importiert zur Laufzeit `docking.js`, `appIcons.js`, `theming.js` und `utils.js` aus der Dock-Erweiterung) und setzt pro Dock, auch bei mehreren Monitoren, ein Element neben „Anwendungen anzeigen“. Wird das Dock aus- oder eingeschaltet oder neu aufgebaut, zieht es mit.
- **`media/`** ist das Medien-Modul:
  - `MediaController` verfolgt die MPRIS-Player, wählt den anzuzeigenden aus, lädt und cached Cover und meldet Änderungen über das Signal `changed`. Die Unschärfe entsteht durch Herunter- und wieder Hochskalieren des Covers (`<sha1>-blur.png`). Cache-Dateien, die älter als 30 Tage sind, werden beim Start gelöscht.
  - `DockMediaItem` ist das Icon im Dock (`Dash.DashItemContainer`). Es passt sich der Icon-Größe des Docks an und nutzt dessen Tooltip-Logik.
  - `MediaMenu` ist das Popup: Karte mit unscharfem Cover als Hintergrund, Cover mit Titel und Interpret, oben rechts das Icon des spielenden Players (weiß eingefärbt, öffnet die App) und das Zahnrad für die Einstellungen, darunter die Steuerknöpfe und bei mehreren Playern eine Auswahl. Es wird nur aktualisiert, während es offen ist.
  - `CoverView` ist das Cover mit runden Ecken und Noten-Symbol als Platzhalter, genutzt von Dock-Icon und Popup.

- **`panel/`** ist das Leisten-Modul:
  - `PanelModule` schaltet je nach Einstellung `compact-panel` zwischen der normalen oberen Leiste und `CompactPanel` um, ohne Neuanmeldung.
  - `CompactPanel` blendet die obere Leiste aus und gibt ihren Platz frei (`untrackChrome`). Es setzt in jedes Dock eine `ClockItem` hinter „Anwendungen anzeigen“. Beim Beenden wird die Leiste wiederhergestellt.
  - `ClockItem` zeigt die Uhrzeit einzeilig (z. B. „11:40“) direkt unter „Anwendungen anzeigen“. Beim Überfahren zeigt sie den Text von `SystemStatus`. Ein Linksklick öffnet Kalender und Benachrichtigungen, ein Rechtsklick die Schnelleinstellungen, beides an der Uhr statt an der Leiste.
  - `SystemStatus` liefert Datum, Akkustand (über UPower) und Anzahl der Benachrichtigungen samt „Nicht stören“. Gelesen wird nur beim Überfahren, nichts wird regelmäßig abgefragt.

Ein neues Modul bekommt einen eigenen Ordner mit einer Klasse, die von `Module` erbt, einen Eintrag in `MODULES` in `extension.js` und eine eigene Seite in `prefs.js`.

## Entwicklung

Logs der Erweiterung verfolgen:

```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -i "dock media"
```

Unter Wayland lässt sich eine verschachtelte Testsitzung starten, ohne die eigene Sitzung neu zu starten:

```bash
dbus-run-session gnome-shell --devkit --wayland
```

Hinweis: Die Erweiterung greift auf interne APIs von Dash to Dock / Ubuntu Dock zu (`DockManager`, `_allDocks`, `_showAppsIcon`, `_hookUpLabel` u. a.). Nach Updates des Docks kann eine Anpassung nötig sein.
