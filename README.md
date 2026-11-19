# BZDubuntuUI

Kleine Extras für den Ubuntu-Desktop: Musiksteuerung direkt im Dock, eine aufgeräumte Leiste und ein optionaler Glas-Look. Jede Funktion lässt sich einzeln an- und abschalten.

> Läuft auf **GNOME Shell 50** mit dem Ubuntu Dock (oder Dash to Dock).

## Was steckt drin?

### Musik im Dock

Sobald ein Player Musik spielt (Spotify, Firefox, VLC, Rhythmbox …), erscheint sein Album-Cover im Dock, über „Anwendungen anzeigen“. Läuft nichts, verschwindet es wieder.

| Du machst … | … und das passiert |
|---|---|
| Maus über das Cover | Titel und Interpret werden angezeigt (⏸ heißt pausiert) |
| Linksklick | das Steuerungs-Popup öffnet sich |
| Rechtsklick | die App des Players kommt nach vorne |
| Mittelklick | Play/Pause |
| Scrollen | hoch: vorheriger Titel, runter: nächster Titel |

Das Popup ist eine Karte wie der Medienplayer eines Smartphones, in der Farbe des Covers (oder mit unscharfem Cover dahinter, einstellbar). Oben stehen Cover, Titel und Interpret und rechts das Icon der Player-App. Darunter geht ein Fortschrittsbalken über die ganze Breite: Ein Klick oder Ziehen darauf springt an eine andere Stelle, unter seinen Enden stehen die gespielte und die ganze Zeit. Ganz unten liegen Zufallswiedergabe, Zurück, ein großes Play/Pause, Weiter und Wiederholen (Titel oder Liste) in einer Reihe. Ein Klick auf Cover, Titel oder App-Icon holt die App des Players nach vorne. Darunter regelst du die Lautstärke, und ein Knopf daneben klappt die Ausgabegeräte auf (Lautsprecher, Kopfhörer, Bluetooth). Die Balken haben die kräftige Farbe des Covers, und beim nächsten Titel blenden Cover und Hintergrund weich über *(alles einzeln abschaltbar)*.

Im Dock zeigt ein Ring um das Cover, wie weit der Titel ist. Ist die Musik pausiert, wird das Cover abgedunkelt und zeigt ⏸ *(abschaltbar, Ringbreite einstellbar)*. Ist das Cover hell, wird die Schrift dunkel. Laufen mehrere Player gleichzeitig, wählst du darunter aus, welcher angezeigt wird.

GNOMEs eigene Medienkarte über den Benachrichtigungen blendet die Erweiterung dann aus, der Player ist ja schon im Dock *(abschaltbar)*.

### Kompakte Leiste *(optional)*

Die obere Leiste verschwindet und du gewinnst den Platz. Was sie angezeigt hat, wandert ins Dock:

- **oben im Dock:** die Arbeitsflächen-Anzeige (ein Punkt pro Arbeitsfläche, die aktive als breite Pille)
- **ganz unten im Dock:** die Uhr in einer eigenen Pille *(abschaltbar)*, direkt unter „Anwendungen anzeigen“, und darunter der Akkustand, mit Prozentzahl, wenn sie in GNOMEs Einstellungen unter Energie eingeschaltet ist *(abschaltbar)*; grün beim Laden und rot ab 20 % *(abschaltbar)*. Ein kleiner Punkt neben der Uhrzeit zeigt ungelesene Benachrichtigungen, wie sonst neben der Uhr in der Leiste.
- **direkt über „Anwendungen anzeigen“** (unter dem Cover): die Statussymbole der Leiste, nur solange sie aktiv sind: Tray-Symbole von Apps (z. B. Discord), Tastaturlayout, Barrierefreiheit und Symbole anderer Erweiterungen. Damit das Dock aufgeräumt bleibt, liegen sie hinter einem Knopf ›, der sie in einem kleinen Popup daneben öffnet. Kommt oder geht der Knopf, bleiben App-Raster und Uhr, wo sie sind. Nur die rote Anzeige bei Bildschirmaufnahme und die orange bei Bildschirmfreigabe stehen immer direkt im Dock, als Pillen in ihrer Farbe, mit Liquid Glass als farbiges Glas. Es sind die echten Symbole, ein Klick verhält sich also wie in der Leiste *(abschaltbar; auch ohne Knopf, alle direkt im Dock)*.

| Wo | Du machst … | … und das passiert |
|---|---|---|
| Uhr | Maus drüber | Datum, Akkustand und Benachrichtigungen auf einen Blick |
| Uhr | Linksklick | Kalender und Benachrichtigungen öffnen sich neben dem Dock |
| Uhr | Rechtsklick | Schnelleinstellungen (WLAN, Ton, Ausschalten …) |
| Knopf › | Klick | die Statussymbole öffnen sich daneben; ein Klick woanders oder Escape schließt sie |
| Statussymbol | Klick | wie in der Leiste: sein Menü, bei Aufnahme und Freigabe beenden |
| Arbeitsflächen | Klick | die Übersicht öffnet sich, wie bei „Aktivitäten“ |
| Arbeitsflächen | Scrollen | zur nächsten oder vorherigen Arbeitsfläche wechseln |

Links- und Rechtsklick an der Uhr lassen sich in den Einstellungen tauschen.

### Alles in einem Panel *(optional)*

Wie ein Kontrollzentrum: Schnelleinstellungen, Benachrichtigungen und Kalender liegen zusammen in einem Panel über die ganze Bildschirmhöhe. Oben die Kacheln (WLAN, Ton, Ausschalten …), darunter die Benachrichtigungen unter ihrer Überschrift, mit „Leeren“ daneben, sobald es etwas zu löschen gibt, und unten der Monatskalender als eigene, schlanke Karte. Ein Klick auf die Uhr öffnet es, mit sichtbarer oberer Leiste auch die Uhr dort und das Kalender-Kürzel. Die Datumszeile über dem Kalender sowie Termine, Weltuhren und Wetter darunter bleiben dabei weg, damit die Benachrichtigungen Platz haben. Funktioniert mit und ohne kompakte Leiste.

### One-UI-Look *(Standard, umschaltbar)*

Menüs, Popups, das Kontrollzentrum und der Musik-Player rund und kompakt wie bei One UI 9: sehr runde Ecken, Kacheln als Pillen mit jedem Symbol in einem eigenen Kreis, schlanke Regler, Menüzeilen als Pillen, Kalendertage als Kreise und runde Knöpfe im Musik-Player mit größerem Play-Knopf. In Dialogen ist der Knopf, den Enter drückt (Ausschalten, Neu starten …), in der Akzentfarbe gefüllt, Eingabefelder sind Pillen. Solange das Kontrollzentrum offen ist, landen neue Benachrichtigungen direkt in seiner Liste statt als Banner daneben. Das Dock behält seinen Look. In den Einstellungen unter Aussehen → Stil lässt sich zurück auf den GNOME-Look schalten.

### Liquid Glass *(optional)*

Ein Glas-Look statt grauer Flächen, wahlweise **getönt** (Milchglas) oder **klar** wie bei macOS: kaum getönt und nur leicht weichgezeichnet, das Hintergrundbild scheint deutlich durch. Dock, Popups, Hover-Texte und Fenster bekommen dabei dasselbe Glas, gleich hell und gleich weich:

- **Popups** wie Kalender, Schnelleinstellungen und das Musik-Popup zeichnen weich, was wirklich dahinter liegt, auch Fenster. Ohne **Live-Unschärfe** zeigen sie stattdessen dein weichgezeichnetes Hintergrundbild, wie das Dock *(spart Grafikleistung)*.
- **Das Dock** bekommt dein weichgezeichnetes Hintergrundbild.
- **Glas überall:** auch Menüs, Benachrichtigungen, der Ausschalten-Dialog („… in 60 Sekunden“), die Lautstärke- und Helligkeitsanzeige, der Fensterwechsler (Alt+Tab), die Punkte beim Wechseln der Arbeitsfläche, die Leiste des Bildschirmfoto-Werkzeugs und die Größenanzeige beim Ändern der Fenstergröße. Was GNOME auch im hellen Stil dunkel hält (Anzeigen, Wechsler, Bildschirmfoto, Suche der Übersicht), bleibt auch als Glas dunkel mit weißer Schrift. Knöpfe, Schalter, Regler und Menüeinträge darin passen sich dem Glas an, ebenso die Untermenüs der Schnelleinstellungen (Ausschalten, WLAN, Bluetooth, Energiemodus …) und aufgeklappte Untermenüs im Dock-Rechtsklick.
- **Fenster als Glas:** Bei GNOME-Apps wie Dateien, Einstellungen oder Texteditor wird nur der Hintergrund zu Glas, ähnlich wie Mica bei Windows 11: Text, Symbole und Bilder bleiben scharf und voll deckend. Die Seitenleiste (etwa in Dateien links) ist klareres Glas als der Inhalt rechts daneben, wie bei macOS. Eine Tönung im Stil der App liegt zwischen dem Fenster und dem, was dahinter ist, damit auch ein helles Fenster dahinter eine dunkle App nicht verwäscht. Hinter dem Glas erscheint dein weichgezeichnetes Hintergrundbild; auf Wunsch auch die Fenster darunter, live weichgezeichnet *(aus, weil es bei jeder Änderung des Fensters dahinter neu rechnet)*. Apps mit eigenem Design (Browser, Spotify, Discord, Spiele) bleiben, wie sie sind.

- **Glas in der Übersicht:** Übersicht und App-Raster liegen auf dem weichgezeichneten Hintergrundbild statt auf Grau; Suchfeld, Suchergebnisse und App-Ordner sind Glas.

Das Glas passt sich dem hellen und dunklen Modus an: im dunklen Modus dunkles Glas, im hellen helles, jeweils passend zur Schriftfarbe. Wie bei Apples Liquid Glass fängt es oben Licht, mit einer feinen hellen Kante (Stärke einstellbar), und es nimmt einen Hauch der Farbe deines Hintergrundbilds an (Stärke einstellbar). Alles wirkt sofort, ohne neu anzumelden.

### Kleinigkeiten

- **Zoom beim Überfahren:** Die App-Icons im Dock wachsen zum Mauszeiger hin wie bei macOS, das darunter am meisten, die Nachbarn weniger. Vergrößerung und Reichweite sind einstellbar *(optional)*.
- **Start-Feedback:** Startest du eine App aus dem Dock, hüpft ihr Icon wie bei macOS, bis ihr erstes Fenster da ist. Weitere Klicks währenddessen öffnen sie nicht noch einmal, so gehen bei langsam startenden Apps keine Fenster mehrfach auf. Strg+Klick öffnet weiterhin bewusst ein neues Fenster *(abschaltbar)*.
- **Benachrichtigungs-Abzeichen:** die Anzeige ungelesener Benachrichtigungen an App-Icons als Zahl, als schlichter Punkt oder gar nicht, in der Farbe des Themes, deiner Akzentfarbe oder einer eigenen. Beim Zoom wächst das Abzeichen mit dem Icon mit.
- **„Anwendungen anzeigen“ als Pille:** das Raster auf einer Pille, so groß wie der ›-Knopf darüber; Cover, ›, Raster und Uhr sind alle gleich breit. Wahlweise das große Raster ohne Pille oder nur drei Punkte *(Einstellungen → Leiste → Dock-Ende)*.
- **Glatte Schrift:** Graustufen-Glättung statt Subpixel, damit Text auf Glas (Uhr, Pillen, Popups) keine orange-blauen Farbränder bekommt; gilt fürs ganze System *(Einstellungen → Aussehen → Schrift auf Glas)*.
- **Eigenes Icon für „Anwendungen anzeigen“:** aus einer Auswahl, per Icon-Name oder als eigenes Bild.
- **Puzzle-Icon in den Schnelleinstellungen:** öffnet direkt die Einstellungen dieser Erweiterung.

## Installation

Du brauchst:

- Ubuntu mit GNOME Shell 50
- das Ubuntu Dock (ist vorinstalliert) oder [Dash to Dock](https://extensions.gnome.org/extension/307/dash-to-dock/)
- für die Musikfunktion einen Player, der MPRIS unterstützt (das können fast alle)

So geht's:

1. Herunterladen:
   ```bash
   git clone https://github.com/BetrickBZD/BZDubuntuUI.git ~/.local/share/gnome-shell/extensions/dock-media@yekda
   ```
   Der Ordner muss genau `dock-media@yekda` heißen, das ist die interne Kennung der Erweiterung.
2. Einmal ab- und wieder anmelden. Unter Wayland lädt GNOME neue Erweiterungen erst dann.
3. Einschalten, entweder in der App „Erweiterungen“ oder im Terminal:
   ```bash
   gnome-extensions enable dock-media@yekda
   ```

## Einstellungen

Du öffnest sie über das Puzzle-Icon in den Schnelleinstellungen, in der App „Erweiterungen“ oder mit `gnome-extensions prefs dock-media@yekda`. Jede Änderung wirkt sofort, ohne Neuanmeldung.

| Seite | Einstellung | Standard |
|---|---|---|
| **Medien** | Hintergrund: Farbe des Covers, unscharfes Cover oder ohne | Farbe des Covers |
| | Abstand der Popups zu Dock und Bildschirmrand | 5 px |
| | GNOMEs Medienkarte im Benachrichtigungs-Popup ausblenden | an |
| | Fortschrittsring im Dock (Breite 1–4 px) | an, 2 px |
| | Balken in Cover-Farbe | an |
| | Lautstärke und Ausgabegerät | an |
| | Weicher Titelwechsel | an |
| **Leiste** | Kompakte Leiste | aus |
| | Statussymbole im Dock² | an |
| | Statussymbole hinter einem Knopf einklappen² | an |
| | Pillen am Dock-Ende (Uhr, ›, „Anwendungen anzeigen“)² | an |
| | „Anwendungen anzeigen“: Pille, groß oder Punkte | Pille |
| | Akku in der Uhr² | an |
| | Akku farbig (grün beim Laden, rot ab 20 %)² | an |
| | Klicks an der Uhr tauschen² | aus |
| | Alles in einem Panel (Schnelleinstellungen, Benachrichtigungen, Kalender) | aus |
| | Einstellungs-Icon (Puzzle) in den Schnelleinstellungen | an |
| **Aussehen** | Look: One UI oder GNOME | One UI |
| | Neue Benachrichtigungen: unten links neben dem Dock oder oben links, Mitte, rechts | unten links |
| | Liquid Glass | aus |
| | Glas: getönt oder klar¹ | getönt |
| | Glas überall¹ | an |
| | Lichtkante¹ (0–100 %) | 60 % |
| | Glas in der Farbe des Hintergrundbilds¹ (Stärke 0–40 %) | an, 15 % |
| | Glas in der Übersicht¹ | an |
| | Fenster als Glas¹ | an |
| | Live-Unschärfe hinter Popups und Fenstern¹ (aus spart Grafikleistung) | an |
| | Deckkraft des Fensterhintergrunds: weniger zeigt mehr Glas, Text bleibt immer deckend | 80 % |
| | Zoom beim Überfahren (Vergrößerung 110–200 %, Reichweite 1–4 Icons) | aus, 150 %, 2 |
| | Benachrichtigungs-Abzeichen: Zahl, Punkt oder aus; Farbe: Standard, Akzent oder eigene | Zahl, Standard |
| | Icon für „Anwendungen anzeigen“ | Original |

¹ wirkt nur, wenn Liquid Glass eingeschaltet ist
² wirkt nur mit der kompakten Leiste

<details>
<summary>Einstellungen per Terminal ändern</summary>

```bash
gsettings --schemadir ~/.local/share/gnome-shell/extensions/dock-media@yekda/schemas \
  set org.gnome.shell.extensions.dock-media glass-style true
```

| Schlüssel | Typ | Standard |
|---|---|---|
| `media-background` | `color`, `blur` oder `none` | `color` |
| `popup-margin` | Pixel (0–64) | `5` |
| `hide-panel-media` | an/aus | `true` |
| `compact-panel` | an/aus | `false` |
| `compact-status-icons` | an/aus | `true` |
| `status-collapse` | an/aus | `true` |
| `compact-battery` | an/aus | `true` |
| `battery-colors` | an/aus | `true` |
| `clock-pill` | an/aus | `true` |
| `clock-swap-clicks` | an/aus | `false` |
| `unified-panel` | an/aus | `false` |
| `menu-settings-button` | an/aus | `true` |
| `ui-style` | `oneui` oder `standard` | `oneui` |
| `banner-position` | `bottom-start`, `start`, `center` oder `end` | `bottom-start` |
| `glass-style` | an/aus | `false` |
| `glass-mode` | `tinted` oder `clear` | `tinted` |
| `glass-everywhere` | an/aus | `true` |
| `window-glass` | an/aus | `true` |
| `glass-live` | an/aus | `true` |
| `window-glass-opacity` | Prozent (60–100) | `80` |
| `dock-magnify` | an/aus | `false` |
| `dock-magnify-zoom` | Prozent (110–200) | `150` |
| `dock-launch-feedback` | an/aus | `true` |
| `dock-badge-style` | `number`, `dot` oder `hidden` | `number` |
| `dock-badge-color-mode` | `theme`, `accent` oder `custom` | `theme` |
| `dock-badge-color` | `#rrggbb` | `#e01b24` |
| `dock-magnify-range` | Icons (1–4) | `2` |
| `dock-progress-ring` | an/aus | `true` |
| `dock-progress-ring-width` | Pixel (1–4) | `2` |
| `media-progress-color` | an/aus | `true` |
| `media-volume` | an/aus | `true` |
| `media-crossfade` | an/aus | `true` |
| `glass-shine` | Prozent (0–100) | `60` |
| `glass-tint-wallpaper` | an/aus | `true` |
| `glass-tint-strength` | Prozent (0–40) | `15` |
| `glass-overview` | an/aus | `true` |
| `show-apps-style` | `pill`, `grid` oder `thin` | `pill` |
| `show-apps-icon` | Icon-Name oder Bildpfad, leer = Original | `''` |

</details>

## Gut zu wissen

**Welcher Player wird angezeigt?**
Der Reihe nach: der Player, den du im Popup ausgewählt hast, sonst einer, der gerade spielt, sonst der zuletzt angezeigte, sonst Spotify, sonst irgendein laufender.

**Kostet das Akku?**
Kaum. Nichts wird im Hintergrund regelmäßig abgefragt: Die Uhr liest Akku und Benachrichtigungen erst, wenn du mit der Maus darüberfährst. Die Position des Titels fragt das Musik-Popup nur einmal beim Öffnen ab und zählt dann selbst weiter, solange es offen ist; die Farbe des Covers wird einmal pro Titel aus ein paar Pixeln berechnet. Die Statussymbole sind die der Leiste selbst, und der Akku zeigt GNOMEs eigene Anzeige: Beides kostet nichts extra. Der Fortschrittsring im Dock rückt nur so oft weiter, wie er sich sichtbar bewegt (bei einem einstündigen Podcast alle 15 Sekunden statt jede Sekunde). Die echte Unschärfe von Liquid Glass läuft nur, solange ein Popup offen ist, und rechnet nur neu, wenn sich direkt dahinter etwas bewegt: Ein Video an anderer Stelle des Bildschirms kostet nichts. Für Dock und Fenster wird das weichgezeichnete Hintergrundbild einmal berechnet und danach nur noch angezeigt. Liegt hinter einem Glas-Fenster ein anderes Fenster, wird nur dieses live weichgezeichnet, und nur neu, wenn es sich ändert oder eins der beiden bewegt wird. Welche Teile eines Glas-Fensters Hintergrund sind, rechnet die Grafikkarte beim Zeichnen mit aus; ein Fenster, in dem sich nichts tut, kostet dabei so gut wie nichts. Vollbild-Fenster bleiben ganz unberührt, so kann GNOME Videos und Spiele im Vollbild direkt an den Bildschirm geben, ohne jedes Bild selbst zusammenzusetzen.

**Wie erkennt die Erweiterung den Hintergrund eines Fensters?**
An der Farbe: GNOMEs Apps zeichnen ihn in neutralen Grautönen, im dunklen Stil dunkel, im hellen fast weiß. Solche Pixel werden durchsichtig, farbige bleiben, wie sie sind; an den Rändern von Schrift wird genau der Anteil des Hintergrunds durchsichtig. Deshalb wirken im hellen Stil auch rein weiße Symbole etwas durchscheinend.

**Warum haben nicht alle Fenster Glas?**
Mit Absicht. Bei Apps mit eigenem Design sähe es falsch aus, und jedes durchsichtige Fenster zwingt GNOME, alles darunter mitzuzeichnen. Deshalb bekommen nur GNOME-Apps Glas, und keine Fenster im Vollbild.

**Wo landen die Album-Cover?**
In `~/.cache/dock-media`. Dateien, die älter als 30 Tage sind, löscht die Erweiterung beim Start selbst. Du kannst den Ordner auch jederzeit gefahrlos leeren.

**Bekannte Grenzen**
- Auf dem Sperrbildschirm erscheint die normale obere Leiste, weil GNOME Erweiterungen beim Sperren abschaltet.
- Die Statussymbole erscheinen nur im Dock des Hauptbildschirms: Jedes Symbol kann nur an einer Stelle sein.
- Ist ein Statussymbol breiter als das Dock (z. B. ein Text einer anderen Erweiterung), wird es mit „…“ gekürzt, damit das Dock seine Breite behält.
- Öffnest du den Kalender per Tastenkürzel (Super+V), erscheint er oben statt an der Uhr.
- Hinter dem Dock zeigt das Glas immer dein Hintergrundbild, nie Fenster.
- Zufallswiedergabe und Wiederholen erscheinen nur, wenn der Player sie über MPRIS anbietet; manche (z. B. Browser) tun das nicht.
- Die Erweiterung nutzt interne Teile von GNOME Shell und Ubuntu Dock. Nach größeren Updates kann eine Anpassung nötig sein.

## Für Entwickler

### Aufbau

Die Erweiterung besteht aus drei unabhängigen Modulen, jedes in einem eigenen Ordner:

| Ordner | Inhalt |
|---|---|
| `media/` | Musik im Dock: Player-Auswahl und Cover-Cache, das Cover im Dock, das Popup |
| `panel/` | kompakte Leiste: Uhr, Akku, Arbeitsflächen-Anzeige, Statussymbole, Hover-Text, Puzzle-Icon |
| `appearance/` | Liquid Glass, Zoom beim Überfahren, „Anwendungen anzeigen“-Icon |
| `appearance/themes/` | die Themes von Liquid Glass: Farben und Maße je Theme, siehe unten |
| `lib/` | gemeinsame Bausteine: Basisklasse für Module, Anbindung ans Dock, Popup-Platzierung, Hover-Texte |
| `preferences/` | Einstellungsfenster: Schalter-Karten mit gezeichneten Vorschaubildern |

`extension.js` startet die Module und beendet sie wieder. Fällt eines beim Start aus, laufen die anderen trotzdem weiter. `prefs.js` baut das Einstellungsfenster mit einer Seite pro Modul.

<details>
<summary>Klassen im Überblick</summary>

```
extension.js
├── MediaModule (media/)
│   ├── MediaController      Player beobachten, Cover laden und zwischenspeichern
│   │   └── PlaybackState    Position, Zufall, Wiederholen; nur solange Popup oder Ring sie brauchen
│   ├── DockMediaItem        das Cover im Dock, mit Fortschrittsring (CoverView)
│   │   └── MediaMenu        das Steuerungs-Popup
│   │       └── OutputDevices  Lautstärke und Ausgabegeräte; nur solange offen
│   └── PanelMediaHider      blendet GNOMEs Medienkarte aus
├── PanelModule (panel/)
│   ├── CompactPanel         obere Leiste aus, Teile ins Dock
│   │   ├── WorkspacesItem   Arbeitsflächen oben im Dock
│   │   ├── StatusArea       Statussymbole der Leiste über dem App-Raster
│   │   │   └── StatusTray   Knopf und Popup für die eingeklappten Symbole
│   │   ├── ClockItem        Uhr ganz unten im Dock
│   │   │   └── BatteryView  Akku unter der Uhrzeit
│   │   └── SystemStatus     Text für den Hover der Uhr
│   ├── UnifiedPanel         Schnelleinstellungen, Benachrichtigungen und Kalender in einem Panel
│   └── SettingsShortcut     Puzzle-Icon in den Schnelleinstellungen
└── AppearanceModule (appearance/)
    ├── LiquidGlass          verteilt das Glas
    │   ├── ThemeStylesheet  lädt das Theme für hell oder dunkel
    │   ├── LiveGlassSurface Live-Unschärfe hinter Popups
    │   ├── QuickSettingsGlass  Kacheln unter Untermenüs (Ausschalten, WLAN …) weichzeichnen
    │   ├── GlassBackdrop    weichgezeichnetes Hintergrundbild und seine Farbe
    │   ├── DockGlassLayer   Glas fürs Dock
    │   └── WindowGlass      Glas für GNOME-Apps
    ├── DockMagnifier        Fischaugen-Zoom beim Überfahren
    ├── DockBadges           Aussehen der Benachrichtigungs-Abzeichen
    ├── LaunchFeedback       Icon hüpft beim Starten, keine Mehrfachstarts
    └── ShowAppsIcon         eigenes „Anwendungen anzeigen“-Icon
```

</details>

### Themes

Wie das Glas aussieht, steht an einer Stelle: in `appearance/themes/`. Ein Theme besteht aus zwei Dateien:

- **`<name>.js`** mit den Werten: gemeinsame Maße (Radius, Stärke der Unschärfe, Sättigung des Hintergrundbilds), je eine Farbpalette für `dark` und `light` und unter `modes` die Varianten für `glass-mode` (z. B. `clear`), die nur die abweichenden Werte nennen. Dock und Fenster nutzen dieselbe Unschärfe und Helligkeit wie die Popups, das Hintergrundbild wird daraus berechnet
- **`<name>.css`** als Vorlage, in der `@name@` für einen Wert steht, z. B. `background-color: @surface@;`

Beim Einschalten und wenn du zwischen hell und dunkel wechselst, füllt `ThemeStylesheet` die Vorlage einmal mit den passenden Werten, legt das Ergebnis in `~/.cache/dock-media/` ab und lädt es. Im laufenden Betrieb kostet ein Theme also nichts.

Ein neues Theme: beide Dateien anlegen (am einfachsten `liquidGlass.*` kopieren und anpassen) und in `appearance/themes/index.js` eintragen. Fehlt in der Palette ein Wert, den die Vorlage benutzt, steht das als Warnung im Log. Welches Theme gilt, legt `LiquidGlass` fest; solange es nur eines gibt, ist das `liquid-glass`. Mit einem zweiten Theme kommt dafür eine Auswahl in die Einstellungen.

### Ein neues Modul hinzufügen

1. Einen neuen Ordner mit einer Klasse anlegen, die von `Module` (`lib/module.js`) erbt: Im Konstruktor startet sie, in `destroy()` räumt sie alles wieder auf.
2. Die Klasse in `extension.js` in die Liste `MODULES` eintragen.
3. In `prefs.js` eine eigene Seite für ihre Einstellungen ergänzen.

### Testen und Fehlersuche

- **Änderungen am Code** werden unter Wayland erst nach Ab- und wieder Anmelden aktiv. Ohne Abmelden geht es in einer Testsitzung im Fenster:
  ```bash
  dbus-run-session gnome-shell --devkit --wayland
  ```
- **Meldungen der Erweiterung** live mitlesen:
  ```bash
  journalctl -f -o cat /usr/bin/gnome-shell | grep -i "dock media"
  ```
- **Nach Änderungen am Einstellungsschema** neu kompilieren. Die kompilierte Datei liegt mit im Repository, damit die Erweiterung direkt nach dem Klonen läuft:
  ```bash
  glib-compile-schemas schemas/
  ```
- **Interne Schnittstellen:** Vom Ubuntu Dock werden `DockManager`, `_allDocks`, `_showAppsIcon` und `_hookUpLabel` genutzt, von GNOME Shell unter anderem `_reposition` der Popups. Ändern die sich bei einem Update, ist hier anzupassen.
