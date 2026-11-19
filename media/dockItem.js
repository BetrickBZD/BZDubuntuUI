import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {showDockLabel} from '../lib/dockLabel.js';

import {CoverView} from './coverView.js';
import {MediaMenu} from './menu.js';

// px a dock pill is wider than the icon size: 2 px padding and a 1 px rim
// on either side
const PILL_EXTRA = 6;

/**
 * The cover icon in the dock, right next to "Show Applications".
 * Hover shows the track, a left click opens the MediaMenu, a right click
 * brings up the player app, a middle click toggles playback and scrolling
 * skips tracks. With 'dock-progress-ring' a ring along the cover's edge
 * shows how far the track is and a paused one is shaded with a pause badge;
 * with 'media-crossfade' a new cover fades in.
 */
export const DockMediaItem = GObject.registerClass(
class DockMediaItem extends Dash.DashItemContainer {
    _init({dash, dockModules, controller, settings}) {
        super._init();
        // Like the dock's own show-apps icon: never take the dock's free
        // space, so the item stays right next to it
        this.x_expand = false;
        this.y_expand = false;

        this._dash = dash;
        this._controller = controller;
        this._settings = settings;

        const {Theming, Utils} = dockModules;
        const position = this._side = Utils.getPosition();
        this.label?.add_style_class_name(Theming.PositionStyleClass[position]);

        this._cover = new CoverView();
        this._button = new St.Button({
            style_class: 'app-well-app dock-media-button',
            track_hover: true,
            can_focus: true,
            button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO | St.ButtonMask.THREE,
            child: new St.Bin({style_class: 'overview-icon', child: this._cover}),
        });
        this.setChild(this._button);
        dash._hookUpLabel(this);
        this._addHighlight();

        this._menu = new MediaMenu(this._button, position, {
            controller,
            settings,
            dockBackground: dash._background,
            anchor: this._cover,
        });
        this._menuManager = new PopupMenu.PopupMenuManager(this._button);
        this._menuManager.addMenu(this._menu);
        Main.uiGroup.add_child(this._menu.actor);
        this._menu.actor.hide();
        this._menu.connect('open-state-changed', (_m, open) => {
            dash._itemMenuStateChanged(this, open);
            this._button.checked = open;
        });

        this._button.connect('clicked', (_b, button) => this._onClicked(button));
        this._button.connect('scroll-event', (_b, event) => this._onScroll(event));
        dash.connectObject('icon-size-changed', () => this._syncSize(), this);
        controller.connectObject('changed', () => this._sync(), this);
        controller.state.connectObject('changed', () => this._syncProgress(), this);
        settings.connectObject(
            'changed::dock-progress-ring', () => this._syncRing(),
            'changed::dock-progress-ring-width', () => this._syncRing(),
            'changed::media-crossfade', () => this._syncRing(),
            this);
        this.connect('destroy', () => this._onDestroy());

        this._syncSize();
        this._syncRing();
    }

    _syncRing() {
        const ring = this._settings.get_boolean('dock-progress-ring');
        this._cover.crossfade = this._settings.get_boolean('media-crossfade');
        this._cover.setRing(ring ? this._settings.get_int('dock-progress-ring-width') : 0);
        this._syncProgress();
        this._sync();
    }

    _syncProgress() {
        const {length, position} = this._controller.state;
        const ring = this._settings.get_boolean('dock-progress-ring');
        this._cover.setProgress(ring && length > 0 ? position / length : null);
    }

    // The dock's grey hover tile peeks out around the cover as a cut-off
    // frame (disabled in the stylesheet); light up the cover instead
    _addHighlight() {
        const highlight = new Clutter.BrightnessContrastEffect({enabled: false});
        highlight.set_brightness(0.12);
        this._cover.add_effect(highlight);

        const sync = () => {
            highlight.enabled = this._button.hover || this._button.checked;
        };
        this._button.connect('notify::hover', sync);
        this._button.connect('notify::checked', sync);
    }

    showLabel() {
        if (!this._menu.isOpen)
            showDockLabel(this, this._side);
    }

    _onClicked(button) {
        if (button === Clutter.BUTTON_MIDDLE) {
            this._controller.player?.playPause();
        } else if (button === Clutter.BUTTON_SECONDARY) {
            this._menu.close();
            this._controller.player?.raise();
        } else {
            this._menu.toggle();
        }
    }

    _onScroll(event) {
        const {player} = this._controller;
        if (!player)
            return Clutter.EVENT_PROPAGATE;

        const dir = event.get_scroll_direction();
        if (dir === Clutter.ScrollDirection.UP && player.canGoPrevious)
            player.previous();
        else if (dir === Clutter.ScrollDirection.DOWN && player.canGoNext)
            player.next();
        return Clutter.EVENT_STOP;
    }

    // As wide as the pills below it (tray button, status pills, clock):
    // they are the icon size plus their padding and rim, see
    // stylesheet.css (.bzd-dock-pill)
    _syncSize() {
        this._cover.setSize(this._dash.iconSize + PILL_EXTRA);
        this._sync();
    }

    _sync() {
        const {player, coverPath} = this._controller;
        if (!player) {
            this._menu.close();
            this.hide();
            return;
        }

        this._cover.setCover(coverPath);
        this._cover.setPaused(this._settings.get_boolean('dock-progress-ring') &&
            player.status !== 'Playing');

        const artists = player.trackArtists?.join(', ');
        const paused = player.status === 'Playing' ? '' : '⏸ ';
        this.setLabelText(`${paused}${player.trackTitle}${artists ? ` – ${artists}` : ''}`);

        if (!this.visible || this.opacity === 0) {
            this.visible = true;
            this.show(true);
        }
    }

    _onDestroy() {
        this._menuManager.removeMenu(this._menu);
        this._menu.destroy();
        this._dash.disconnectObject(this);
        this._controller.disconnectObject(this);
        this._controller.state.disconnectObject(this);
        this._settings.disconnectObject(this);
    }
});
