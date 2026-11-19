import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider from 'resource:///org/gnome/shell/ui/slider.js';

import {blockBanners} from '../lib/bannerBlock.js';
import {brightness, darkened, lightened, vivid} from '../lib/color.js';
import {placeNextToDock} from '../lib/dockPlacement.js';
import {glassTargets} from '../lib/glassTargets.js';

import {CoverView} from './coverView.js';
import {OutputDevices} from './outputDevices.js';
import {LOOP_ORDER} from './playbackState.js';

const COVER_SIZE = 52;
// Above this brightness the cover's color gets dark text; below it, it is
// darkened to at most DARK_COLOR so white text stays readable
const LIGHT_COLOR = 0.6;
const DARK_COLOR = 0.36;
// Brightness of the progress bar in the cover's color: at least BAR_LIGHT
// on a dark card, at most BAR_DARK on a light one
const BAR_LIGHT = 0.6;
const BAR_DARK = 0.3;
const FADE_DURATION = 250; // ms
// Settings the card shows
const SETTINGS = [
    'media-background', 'glass-style', 'glass-mode',
    'media-progress-color', 'media-volume', 'media-crossfade',
];
const VOLUME_ICONS = [
    'audio-volume-muted-symbolic',
    'audio-volume-low-symbolic',
    'audio-volume-medium-symbolic',
    'audio-volume-high-symbolic',
];
// App icon for players without an app
const FALLBACK_ICON = new Gio.ThemedIcon({name: 'audio-x-generic-symbolic'});

/**
 * Popup card for the MediaController's player, laid out like a phone's
 * media player: on top cover, title and artist, with the player app's icon
 * on the right; below a wide progress bar to seek with (in the cover's
 * color with 'media-progress-color'), the elapsed and the whole time under
 * its ends, then shuffle, previous, play/pause, next and repeat in one row;
 * with 'media-volume' the system volume and a button to pick the sound
 * output; then a player chooser. A click on the cover, the title or the app
 * icon brings up the player app. The background is the cover's color, the
 * blurred cover or none ('media-background'), fading over to the next one
 * with 'media-crossfade'. Placed next to the dock, lined up with the cover.
 * The playback state is the controller's, held while the popup is open.
 */
export class MediaMenu extends PopupMenu.PopupMenu {
    constructor(sourceActor, side, {controller, settings, dockBackground, anchor}) {
        super(sourceActor, 0.5, side);
        this._controller = controller;
        this._settings = settings;
        this._state = controller.state;
        this._outputs = new OutputDevices();
        this._outputsOpen = false;
        this._outputsRunning = false;
        this._settingVolume = false;
        this._shownPlayers = [];
        this._seeking = false;
        this._settingProgress = false;

        this.actor.add_style_class_name('dock-media-menu');
        // Added directly instead of as a menu item, which would get dimmed
        // as insensitive and padded like a menu row
        this.box.add_child(this._buildCard());
        glassTargets.add(this.box);

        placeNextToDock(this._boxPointer, () => ({
            dock: dockBackground,
            anchor,
            margin: settings.get_int('popup-margin'),
        }));

        // A closed popup is synced on open, so skip work while it is hidden
        const sync = () => {
            if (this.isOpen)
                this._sync();
        };
        controller.connectObject('changed', sync, this);
        for (const key of SETTINGS)
            settings.connectObject(`changed::${key}`, sync, this);
        // The state also runs for the dock's ring while the popup is closed
        this._state.connectObject('changed', () => {
            if (this.isOpen)
                this._syncState();
        }, this);
        this._outputs.connectObject('changed', () => this._syncVolume(), this);
        this._syncState();
        this.connect('open-state-changed', (_m, open) => {
            // Banners at the bottom next to the dock would pop up right over
            // the card: they wait until it is closed
            blockBanners(this, open && this._settings.get_string('banner-position') === 'bottom-start');
            if (open)
                return;
            this._controller.releaseState();
            this._outputs.stop();
            this._outputsRunning = false;
            this._setOutputsOpen(false);
        });
    }

    open(animate) {
        this._controller.holdState();
        this._sync();
        this._syncState();
        super.open(animate);
    }

    _buildCard() {
        // Background (color or blurred cover), a shade over the blurred
        // cover, content on top
        this._card = new St.Widget({
            style_class: 'dock-media-card',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
        });
        this._background = new St.Widget({
            style_class: 'dock-media-background',
            x_expand: true,
            y_expand: true,
        });
        this._shade = new St.Widget({style_class: 'dock-media-shade', x_expand: true, y_expand: true});
        this._card.add_child(this._background);
        this._card.add_child(this._shade);

        const content = new St.BoxLayout({
            style_class: 'dock-media-box',
            vertical: true,
            x_expand: true,
        });
        content.add_child(this._buildHeader());
        content.add_child(this._buildProgress());
        content.add_child(this._buildTimes());
        content.add_child(this._buildControls());
        content.add_child(this._buildVolume());
        this._card.add_child(content);

        // The player chooser goes into the card too, the popup has no background
        this._playersSection = new PopupMenu.PopupMenuSection();
        this.addMenuItem(this._playersSection);
        this.box.remove_child(this._playersSection.actor);
        content.add_child(this._playersSection.actor);

        return this._card;
    }

    // Cover | title and artist | app icon
    _buildHeader() {
        const header = new St.BoxLayout({style_class: 'dock-media-header'});

        // Cover and title bring up the player app; the cover lights up
        // under the pointer like the one in the dock
        this._cover = new CoverView();
        this._cover.setSize(COVER_SIZE);
        const highlight = new Clutter.BrightnessContrastEffect({enabled: false});
        highlight.set_brightness(0.12);
        this._cover.add_effect(highlight);
        const coverButton = this._openButton(this._cover);
        coverButton.y_align = Clutter.ActorAlign.CENTER;
        coverButton.connect('notify::hover', () => (highlight.enabled = coverButton.hover));
        header.add_child(coverButton);

        const labels = new St.BoxLayout({style_class: 'dock-media-info', vertical: true});
        this._title = new St.Label({style_class: 'dock-media-title'});
        this._artist = new St.Label({style_class: 'dock-media-artist'});
        for (const label of [this._title, this._artist]) {
            label.clutter_text.ellipsize = 3; // Pango.EllipsizeMode.END
            labels.add_child(label);
        }
        const title = this._openButton(labels);
        title.set({x_expand: true, x_align: Clutter.ActorAlign.FILL, y_align: Clutter.ActorAlign.CENTER});
        header.add_child(title);

        this._appIcon = new St.Icon({gicon: FALLBACK_ICON});
        const app = this._openButton(this._appIcon);
        app.set({style_class: 'dock-media-action dock-media-app', y_align: Clutter.ActorAlign.START});
        header.add_child(app);

        return header;
    }

    // GNOME's own slider, as for volume and brightness, kept thin
    _buildProgress() {
        this._progress = new Slider.Slider(0);
        this._progress.add_style_class_name('dock-media-progress');
        this._progress.accessible_name = 'Wiedergabeposition';
        this._progress.visible = false;
        this._progress.connect('drag-begin', () => (this._seeking = true));
        this._progress.connect('drag-end', () => {
            this._seeking = false;
            this._state.seek(this._progress.value);
        });
        // Scrolling on the slider changes it without dragging
        this._progress.connect('notify::value', () => {
            if (!this._seeking && !this._settingProgress)
                this._state.seek(this._progress.value);
            // While dragging the time shows where the track will go on
            if (this._seeking)
                this._syncTimes(this._progress.value * this._state.length);
        });
        return this._progress;
    }

    // Elapsed | whole time, under the ends of the progress bar
    _buildTimes() {
        this._times = new St.BoxLayout({style_class: 'dock-media-times', visible: false});
        this._elapsed = new St.Label({style_class: 'dock-media-time', x_expand: true});
        this._length = new St.Label({style_class: 'dock-media-time'});
        this._times.add_child(this._elapsed);
        this._times.add_child(this._length);
        return this._times;
    }

    // Shuffle | previous | play/pause | next | repeat, evenly spread
    _buildControls() {
        const controls = new St.BoxLayout({style_class: 'dock-media-controls'});

        this._shuffle = this._actionButton('media-playlist-shuffle-symbolic', 'Zufallswiedergabe',
            () => this._state.setShuffle(!this._state.shuffle));
        this._prev = this._controlButton('media-skip-backward-symbolic', 'Zurück', p => p.previous());
        this._playPause = this._controlButton('media-playback-start-symbolic', 'Wiedergabe', p => p.playPause());
        this._playPause.add_style_class_name('dock-media-play');
        this._next = this._controlButton('media-skip-forward-symbolic', 'Weiter', p => p.next());
        this._repeat = this._actionButton('media-playlist-repeat-symbolic', 'Wiederholen', () => {
            const next = LOOP_ORDER[(LOOP_ORDER.indexOf(this._state.loopStatus) + 1) % LOOP_ORDER.length];
            this._state.setLoopStatus(next);
        });

        for (const button of [this._shuffle, this._prev, this._playPause, this._next, this._repeat]) {
            button.set({x_expand: true, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER});
            controls.add_child(button);
        }
        return controls;
    }

    // Speaker (mutes) | volume | sound output, with the outputs below
    _buildVolume() {
        const box = new St.BoxLayout({vertical: true});
        this._volumeRow = new St.BoxLayout({style_class: 'dock-media-volume'});

        this._volumeIcon = this._actionButton(VOLUME_ICONS[3], 'Stumm', () => this._outputs.toggleMuted());
        this._volume = new Slider.Slider(0);
        this._volume.add_style_class_name('dock-media-progress');
        this._volume.set({x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        this._volume.accessible_name = 'Lautstärke';
        this._volume.connect('notify::value', () => {
            if (!this._settingVolume)
                this._outputs.setVolume(this._volume.value);
        });
        this._outputButton = this._actionButton('audio-headphones-symbolic', 'Tonausgabe',
            () => this._setOutputsOpen(!this._outputsOpen));
        for (const actor of [this._volumeIcon, this._volume, this._outputButton])
            this._volumeRow.add_child(actor);
        box.add_child(this._volumeRow);

        this._outputSection = new PopupMenu.PopupMenuSection();
        this.addMenuItem(this._outputSection);
        this.box.remove_child(this._outputSection.actor);
        box.add_child(this._outputSection.actor);
        return box;
    }

    _setOutputsOpen(open) {
        this._outputsOpen = open;
        this._outputButton.checked = open;
        this._syncOutputs();
    }

    _openButton(child) {
        const button = new St.Button({
            style_class: 'dock-media-open',
            can_focus: true,
            accessible_name: 'Player öffnen',
            child,
        });
        button.connect('clicked', () => {
            this.close();
            this._controller.player?.raise();
        });
        return button;
    }

    _actionButton(iconName, name, action) {
        const button = new St.Button({
            style_class: 'dock-media-action',
            can_focus: true,
            accessible_name: name,
            child: new St.Icon({icon_name: iconName}),
        });
        button.connect('clicked', action);
        return button;
    }

    _controlButton(iconName, name, action) {
        const button = new St.Button({
            style_class: 'dock-media-control',
            can_focus: true,
            accessible_name: name,
            child: new St.Icon({icon_name: iconName}),
        });
        button.connect('clicked', () => {
            const {player} = this._controller;
            if (player)
                action(player);
        });
        return button;
    }

    _sync() {
        const {player, coverPath} = this._controller;
        if (!player)
            return;

        setText(this._title, player.trackTitle || '');
        setText(this._artist, player.trackArtists?.join(', ') || '');
        this._cover.crossfade = this._settings.get_boolean('media-crossfade');
        this._cover.setCover(coverPath);
        const gicon = player.app?.get_icon() ?? FALLBACK_ICON;
        if (!gicon.equal(this._appIcon.gicon))
            this._appIcon.gicon = gicon;
        this._syncBackground();

        this._playPause.child.icon_name = player.status === 'Playing'
            ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
        setAvailable(this._prev, player.canGoPrevious, true);
        setAvailable(this._next, player.canGoNext, true);

        this._syncPlayers(player);

        // The mixer is only listened to while the popup is open
        const volume = this._settings.get_boolean('media-volume');
        this._volumeRow.visible = volume;
        if (volume !== this._outputsRunning) {
            this._outputsRunning = volume;
            if (volume)
                this._outputs.start();
            else
                this._outputs.stop();
        }
        if (!volume && this._outputsOpen)
            this._setOutputsOpen(false);
        this._syncVolume();
    }

    _syncVolume() {
        const {volume} = this._outputs;
        this._volumeRow.reactive = volume !== null;
        this._volumeRow.opacity = volume === null ? 100 : 255;
        if (volume !== null) {
            this._settingVolume = true;
            this._volume.value = volume;
            this._settingVolume = false;
            const level = this._outputs.muted || volume === 0 ? 0 : Math.clamp(Math.ceil(volume * 3), 1, 3);
            this._volumeIcon.child.icon_name = VOLUME_ICONS[level];
        }
        this._syncOutputs();
    }

    // The outputs, while their list is open; the active one has a dot
    _syncOutputs() {
        this._outputSection.removeAll();
        if (!this._outputsOpen)
            return;
        const devices = this._outputs.devices;
        this._outputSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Tonausgabe'));
        for (const {device, name, gicon, active} of devices) {
            const item = new PopupMenu.PopupImageMenuItem(name, gicon);
            item.connect('activate', () => this._outputs.activate(device));
            item.setOrnament(active ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NO_DOT);
            this._outputSection.addMenuItem(item);
        }
        if (!devices.length)
            this._outputSection.addMenuItem(new PopupMenu.PopupMenuItem('Keine Ausgabegeräte', {reactive: false}));
    }

    _syncBackground() {
        const {blurPath, coverColor} = this._controller;
        const mode = this._settings.get_string('media-background');
        const glass = this._settings.get_boolean('glass-style');
        const blur = mode === 'blur' ? blurPath : null;
        const light = mode === 'color' && Boolean(coverColor) && brightness(coverColor) > LIGHT_COLOR;
        const color = mode === 'color' && coverColor
            ? light ? coverColor : darkened(coverColor, DARK_COLOR) : null;

        let style = '';
        if (blur) {
            style = `background-image: url("${blur}"); background-size: cover;`;
        } else if (color) {
            // Under liquid glass the glass shows through the color as on
            // every other popup; a light color, which gets dark text, stays
            // stronger, since the glass behind it is dark
            const {red, green, blue} = color;
            const alpha = glass ? light ? 0.85 : 0.6 : 1;
            style = `background-color: rgba(${red}, ${green}, ${blue}, ${alpha});`;
        }
        if (this._background.style !== style) {
            if (this._settings.get_boolean('media-crossfade') && this._background.style && this.isOpen)
                this._fadeOutBackground();
            this._background.style = style;
        }
        // Under liquid glass the desktop shows through the blurred cover;
        // the shade keeps white text readable on anything but a color
        this._background.opacity = blur && glass ? 110 : 255;
        this._shade.visible = !color;

        if (light)
            this._card.add_style_class_name('bzd-media-light');
        else
            this._card.remove_style_class_name('bzd-media-light');
        this._syncBarColor(light);
    }

    // The old background on top of the new one, fading out
    _fadeOutBackground() {
        const old = new St.Widget({
            style_class: 'dock-media-background',
            style: this._background.style,
            opacity: this._background.opacity,
            x_expand: true,
            y_expand: true,
        });
        this._card.insert_child_above(old, this._background);
        old.ease({
            opacity: 0,
            duration: FADE_DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => old.destroy(),
        });
    }

    // The progress and volume bars in the cover's color at full strength,
    // light enough on a dark card and dark enough on a light one
    _syncBarColor(light) {
        const {coverColor} = this._controller;
        let style = '';
        if (coverColor && this._settings.get_boolean('media-progress-color')) {
            const strong = vivid(coverColor);
            const {red, green, blue} = light ? darkened(strong, BAR_DARK) : lightened(strong, BAR_LIGHT);
            const color = `rgb(${red}, ${green}, ${blue})`;
            style = `-barlevel-active-background-color: ${color}; color: ${color};`;
        }
        for (const bar of [this._progress, this._volume]) {
            if (bar.style !== style)
                bar.style = style;
        }
    }

    // About once a second while playing: only what changed is touched
    _syncState() {
        const {length, canSeek, position, shuffle, loopStatus} = this._state;
        this._progress.visible = length > 0;
        this._times.visible = length > 0;
        if (length > 0) {
            this._progress.reactive = canSeek;
            if (!this._seeking) {
                this._settingProgress = true;
                this._progress.value = position / length;
                this._settingProgress = false;
                this._syncTimes(position);
            }
        }

        // Unsupported ones keep their place, so the row stays centered
        setAvailable(this._shuffle, shuffle !== null);
        this._shuffle.checked = Boolean(shuffle);
        setAvailable(this._repeat, loopStatus !== null);
        this._repeat.checked = loopStatus === 'Playlist' || loopStatus === 'Track';
        this._repeat.child.icon_name = loopStatus === 'Track'
            ? 'media-playlist-repeat-song-symbolic' : 'media-playlist-repeat-symbolic';
    }

    _syncTimes(position) {
        setText(this._elapsed, formatTime(position));
        setText(this._length, formatTime(this._state.length));
    }

    // Rebuilt only when the players or the chosen one changed
    _syncPlayers(current) {
        const players = this._controller.players;
        const shown = players.length < 2 ? [] : [current, ...players];
        if (shown.length === this._shownPlayers.length && shown.every((p, i) => p === this._shownPlayers[i]))
            return;
        this._shownPlayers = shown;

        this._playersSection.removeAll();
        if (!shown.length)
            return;

        this._playersSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        for (const player of players) {
            const name = player.app?.get_name() ?? player.source?.title ?? 'Player';
            const item = this._playersSection.addAction(name,
                () => this._controller.selectPlayer(player));
            item.setOrnament(player === current
                ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NO_DOT);
        }
    }

    destroy() {
        this._controller.disconnectObject(this);
        this._settings.disconnectObject(this);
        this._state.disconnectObject(this);
        this._outputs.disconnectObject(this);
        this._outputs.destroy();
        if (this.isOpen)
            this._controller.releaseState();
        blockBanners(this, false);
        super.destroy();
    }
}

// Setting a label's text, even the same, lays it out anew
function setText(label, text) {
    if (label.text !== text)
        label.text = text;
}

// An unavailable button is dimmed (dim) or invisible, but keeps its place
function setAvailable(button, available, dim = false) {
    button.reactive = available;
    button.can_focus = available;
    button.opacity = available ? 255 : dim ? 100 : 0;
}

// Microseconds as m:ss, or h:mm:ss for long tracks
function formatTime(microseconds) {
    const total = Math.floor(microseconds / 1e6);
    const [hours, minutes, seconds] = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60];
    const pad = n => String(n).padStart(2, '0');
    return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
