import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {CoverView} from './coverView.js';

const COVER_SIZE = 56;
const FALLBACK_APP_ICON = new Gio.ThemedIcon({name: 'applications-multimedia-symbolic'});

/**
 * Popup card for the MediaController's player: blurred cover background,
 * cover with track info, app and settings buttons, playback controls and
 * a player chooser. Placed in the screen corner next to the dock.
 */
export class MediaMenu extends PopupMenu.PopupMenu {
    constructor(sourceActor, side, {controller, settings, openPreferences, dockBackground}) {
        super(sourceActor, 0.5, side);
        this._controller = controller;
        this._dockBackground = dockBackground;
        this._settings = settings;
        this._openPreferences = openPreferences;

        this.actor.add_style_class_name('dock-media-menu');
        // Added directly instead of as a menu item, which would get dimmed
        // as insensitive and padded like a menu row
        this.box.add_child(this._buildCard());

        const reposition = this._boxPointer._reposition.bind(this._boxPointer);
        this._boxPointer._reposition = box => {
            reposition(box);
            this._placeInCorner(box);
        };

        // A closed popup is synced on open, so skip work while it is hidden
        controller.connectObject('changed', () => {
            if (this.isOpen)
                this._sync();
        }, this);
        settings.connectObject('changed', () => {
            if (this.isOpen)
                this._sync();
        }, this);
    }

    open(animate) {
        this._sync();
        super.open(animate);
    }

    _buildCard() {
        // Blurred cover behind a dark shade, content on top
        const card = new St.Widget({
            style_class: 'dock-media-card',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
        });
        this._background = new St.Widget({
            style_class: 'dock-media-background',
            x_expand: true,
            y_expand: true,
        });
        card.add_child(this._background);
        card.add_child(new St.Widget({style_class: 'dock-media-shade', x_expand: true, y_expand: true}));

        const content = new St.BoxLayout({
            style_class: 'dock-media-box',
            vertical: true,
            x_expand: true,
        });
        content.add_child(this._buildHeader());
        content.add_child(this._buildControls());
        card.add_child(content);

        // The player chooser goes into the card too, the popup has no background
        this._playersSection = new PopupMenu.PopupMenuSection();
        this.addMenuItem(this._playersSection);
        this.box.remove_child(this._playersSection.actor);
        content.add_child(this._playersSection.actor);

        return card;
    }

    _buildHeader() {
        const header = new St.BoxLayout({style_class: 'dock-media-header'});

        this._cover = new CoverView({y_align: Clutter.ActorAlign.CENTER});
        this._cover.setSize(COVER_SIZE);
        header.add_child(this._cover);

        const labels = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._title = new St.Label({style_class: 'dock-media-title'});
        this._artist = new St.Label({style_class: 'dock-media-artist'});
        for (const label of [this._title, this._artist]) {
            label.clutter_text.ellipsize = 3; // Pango.EllipsizeMode.END
            labels.add_child(label);
        }
        header.add_child(labels);

        // The playing app's own icon, washed out to white so it matches the
        // symbolic settings icon next to it
        this._appIcon = new St.Icon();
        this._appIcon.add_effect(new Clutter.DesaturateEffect());
        const whiten = new Clutter.BrightnessContrastEffect();
        whiten.set_brightness(0.45);
        this._appIcon.add_effect(whiten);

        const actions = new St.BoxLayout({
            style_class: 'dock-media-actions',
            y_align: Clutter.ActorAlign.START,
        });
        actions.add_child(this._actionButton(this._appIcon,
            () => this._controller.player?.raise()));
        actions.add_child(this._actionButton(new St.Icon({icon_name: 'emblem-system-symbolic'}),
            () => this._openPreferences()));
        header.add_child(actions);

        return header;
    }

    _buildControls() {
        const controls = new St.BoxLayout({
            style_class: 'dock-media-controls',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._prev = this._controlButton('media-skip-backward-symbolic', p => p.previous());
        this._playPause = this._controlButton('media-playback-start-symbolic', p => p.playPause());
        this._next = this._controlButton('media-skip-forward-symbolic', p => p.next());
        controls.add_child(this._prev);
        controls.add_child(this._playPause);
        controls.add_child(this._next);
        return controls;
    }

    _actionButton(icon, action) {
        const button = new St.Button({
            style_class: 'dock-media-action',
            can_focus: true,
            child: icon,
        });
        button.connect('clicked', () => {
            this.close();
            action();
        });
        return button;
    }

    _controlButton(iconName, action) {
        // Same look as GNOME's own media controls in the notification list
        const button = new St.Button({
            style_class: 'message-media-control',
            can_focus: true,
            child: new St.Icon({icon_name: iconName}),
        });
        button.connect('clicked', () => {
            const {player} = this._controller;
            if (player)
                action(player);
        });
        return button;
    }

    // Pin the popup to the bottom-left corner next to the visible dock,
    // popup-margin away from both the dock and the screen edge
    _placeInCorner(box) {
        const bp = this._boxPointer;
        const work = bp._workArea;
        const dock = this._dockBackground?.get_transformed_extents();
        if (!work || !dock || !this._dockBackground.mapped)
            return;

        // The box reserves -arrow-rise on its dock side before the content
        // starts. Clamping to the work area keeps it on screen while the dock
        // slides out (intellihide).
        const rise = bp.getArrowHeight();
        const [, , width, height] = bp.get_preferred_size();
        const margin = this._settings.get_int('popup-margin');
        let x = work.x + margin;
        let y = work.y + work.height - margin - height;
        switch (bp._arrowSide) {
        case St.Side.LEFT:
            x = Math.max(dock.get_x() + dock.get_width(), work.x) + margin - rise;
            break;
        case St.Side.RIGHT:
            x = Math.min(dock.get_x(), work.x + work.width) - margin - width + rise;
            break;
        case St.Side.TOP:
            y = Math.max(dock.get_y() + dock.get_height(), work.y) + margin - rise;
            break;
        case St.Side.BOTTOM:
            y = Math.min(dock.get_y(), work.y + work.height) - margin - height + rise;
            break;
        }

        box.set_origin(Math.floor(x), Math.floor(y));
    }

    _sync() {
        const {player, coverPath, blurPath} = this._controller;
        if (!player)
            return;

        this._title.text = player.trackTitle || '';
        this._artist.text = player.trackArtists?.join(', ') || '';
        this._cover.setCover(coverPath);
        const blur = this._settings.get_boolean('blur-background') && blurPath;
        this._background.style = blur
            ? `background-image: url("${blurPath}"); background-size: cover;` : '';
        this._appIcon.gicon = player.app?.get_icon() ?? FALLBACK_APP_ICON;

        this._playPause.child.icon_name = player.status === 'Playing'
            ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
        for (const [button, enabled] of [[this._prev, player.canGoPrevious], [this._next, player.canGoNext]]) {
            button.reactive = enabled;
            button.opacity = enabled ? 255 : 100;
        }

        this._syncPlayers(player);
    }

    _syncPlayers(current) {
        this._playersSection.removeAll();
        const players = this._controller.players;
        if (players.length < 2)
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
        super.destroy();
    }
}
