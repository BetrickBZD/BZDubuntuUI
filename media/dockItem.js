import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {CoverView} from './coverView.js';
import {MediaMenu} from './menu.js';

/**
 * The cover icon in the dock, right next to "Show Applications".
 * Hover shows the track, left/right click opens the MediaMenu,
 * middle click toggles playback and scrolling skips tracks.
 */
export const DockMediaItem = GObject.registerClass(
class DockMediaItem extends Dash.DashItemContainer {
    _init({dash, dockModules, controller, settings, openPreferences}) {
        super._init();
        // Like the dock's own show-apps icon: never take the dock's free
        // space, so the item stays right next to it
        this.x_expand = false;
        this.y_expand = false;

        this._dash = dash;
        this._controller = controller;

        const {AppIcons, Theming, Utils} = dockModules;
        this._showLabelImpl = AppIcons.itemShowLabel;
        const position = Utils.getPosition();
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
            openPreferences,
            dockBackground: dash._background,
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
        this.connect('destroy', () => this._onDestroy());

        this._syncSize();
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
            this._showLabelImpl.call(this);
    }

    _onClicked(button) {
        if (button === Clutter.BUTTON_MIDDLE)
            this._controller.player?.playPause();
        else
            this._menu.toggle();
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

    _syncSize() {
        this._cover.setSize(this._dash.iconSize);
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
    }
});
