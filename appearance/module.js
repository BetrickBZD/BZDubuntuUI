import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {DockConnector} from '../lib/dockConnector.js';
import {Module} from '../lib/module.js';

import {DockBadges} from './dockBadges.js';
import {DockMagnifier} from './dockMagnifier.js';
import {LaunchFeedback} from './launchFeedback.js';
import {LiquidGlass} from './liquidGlass.js';
import {ShowAppsIcon} from './showAppsIcon.js';

/**
 * Appearance module: the optional LiquidGlass ('glass-style', tinted or
 * clear by 'glass-mode', on all shell surfaces with 'glass-everywhere'; its
 * shine, tint and overview glass follow their settings by themselves), the
 * optional fish-eye zoom of dock icons
 * ('dock-magnify'), a custom "Show Applications" icon in every dock
 * ('show-apps-icon') and the look of the dock's notification badges
 * (DockBadges), hopping icons while their app starts
 * ('dock-launch-feedback', LaunchFeedback), and the One UI look of menus,
 * popups, quick settings and the music card ('ui-style'), and where new
 * notifications show up ('banner-position'): at the top (in the middle
 * they cover the overview's search field once the top bar is hidden) or
 * at the bottom next to the dock, by the clock.
 */
// [x, y] of the banner in the message tray, which spans the screen
const BANNER_PLACES = {
    'start': [Clutter.ActorAlign.START, Clutter.ActorAlign.START],
    'center': [Clutter.ActorAlign.CENTER, Clutter.ActorAlign.START],
    'end': [Clutter.ActorAlign.END, Clutter.ActorAlign.START],
    'bottom-start': [Clutter.ActorAlign.START, Clutter.ActorAlign.END],
};

export class AppearanceModule extends Module {
    constructor(extension) {
        super(extension);
        this._glass = null;
        this._magnifiers = null;
        this.settings.connectObject(
            'changed::glass-style', () => this._syncGlass(),
            'changed::glass-mode', () => this._syncGlass(true),
            'changed::glass-everywhere', () => this._syncGlass(true),
            'changed::window-glass', () => this._syncGlass(true),
            'changed::glass-live', () => this._syncGlass(true),
            'changed::dock-magnify', () => this._syncMagnify(),
            'changed::dock-launch-feedback', () => this._syncLaunch(),
            this);
        this._syncGlass();
        this._syncMagnify();
        this._launch = null;
        this._syncLaunch();

        this._icons = new DockConnector((dash, dockModules) => new ShowAppsIcon(dash, this.settings, dockModules));
        this.settings.connectObject('changed::ui-style', () => this._syncUiStyle(), this);
        this._syncUiStyle();
        this._bannerBin = Main.messageTray._bannerBin ?? null;
        this._bannerAlignment = Main.messageTray.bannerAlignment;
        this._bannerYAlign = this._bannerBin?.y_align;
        this.settings.connectObject(
            'changed::banner-position', () => this._syncBanner(),
            'changed::popup-margin', () => this._syncBanner(),
            this);
        global.display.connectObject('workareas-changed', () => this._syncBanner(), this);
        // The dock may have moved or changed size since: placed anew for
        // every banner, before it is laid out
        this._bannerBin?.connectObject('child-added', () => this._syncBanner(), this);
        this._syncBanner();
        this._badges = new DockConnector(dash => new DockBadges(dash, this.settings));
    }

    // rebuild: the look or the set of glass surfaces changed ('glass-mode',
    // 'glass-everywhere', 'window-glass'); cheap, since the glass image
    // comes from the cache
    _syncGlass(rebuild = false) {
        const glass = this.settings.get_boolean('glass-style');
        if (this._glass && (!glass || rebuild)) {
            this._glass.destroy();
            this._glass = null;
        }
        if (glass && !this._glass)
            this._glass = new LiquidGlass({settings: this.settings, path: this.path});
    }

    _syncLaunch() {
        const on = this.settings.get_boolean('dock-launch-feedback');
        if (on && !this._launch) {
            this._launch = new DockConnector((dash, dockModules) => new LaunchFeedback(dash, dockModules));
        } else if (!on && this._launch) {
            this._launch.destroy();
            this._launch = null;
        }
    }

    _syncMagnify() {
        const magnify = this.settings.get_boolean('dock-magnify');
        if (magnify && !this._magnifiers) {
            this._magnifiers = new DockConnector((dash, dockModules) =>
                new DockMagnifier(dash, dockModules, this.settings));
        } else if (!magnify && this._magnifiers) {
            this._magnifiers.destroy();
            this._magnifiers = null;
        }
    }

    // The One UI look is all in stylesheet.css, under this class on the UI root
    _syncUiStyle() {
        if (this.settings.get_string('ui-style') === 'oneui')
            Main.uiGroup.add_style_class_name('bzd-oneui');
        else
            Main.uiGroup.remove_style_class_name('bzd-oneui');
    }

    // GNOME slides a banner in by its fixed y, from above the screen to 0;
    // the tray's layout still aligns it within the room from there down,
    // so at the bottom it just fades and grows in. Kept clear of the dock
    // and whatever else reserves the screen's edges (the work area; the
    // dock also when it doesn't reserve any), and the popups' margin away
    // from them
    _syncBanner() {
        const [x, y] = BANNER_PLACES[this.settings.get_string('banner-position')] ?? BANNER_PLACES.center;
        Main.messageTray.bannerAlignment = x;
        const bin = this._bannerBin;
        if (!bin)
            return;
        bin.y_align = y;
        const bottom = y === Clutter.ActorAlign.END;
        const {primaryIndex} = Main.layoutManager;
        const monitor = Main.layoutManager.monitors[primaryIndex];
        const work = Main.layoutManager.getWorkAreaForMonitor(primaryIndex);
        // As CSS: St sets an actor's margins from its style on every
        // style change, over any set directly
        if (!bottom || !monitor || !work) {
            bin.style = null;
            return;
        }
        const insets = {
            left: work.x - monitor.x,
            right: monitor.x + monitor.width - work.x - work.width,
            bottom: monitor.y + monitor.height - work.y - work.height,
        };
        for (const dock of Main.uiGroup.get_children()) {
            if (dock.name !== 'dashtodockContainer' || !dock.visible)
                continue;
            const box = dock.get_transformed_extents();
            const [x, y, w, h] = [box.get_x(), box.get_y(), box.get_width(), box.get_height()];
            if (!w || !h || x >= monitor.x + monitor.width || x + w <= monitor.x ||
                y >= monitor.y + monitor.height || y + h <= monitor.y)
                continue;
            if (h > w && x <= monitor.x + 1)
                insets.left = Math.max(insets.left, x + w - monitor.x);
            else if (h > w)
                insets.right = Math.max(insets.right, monitor.x + monitor.width - x);
            else if (y + h >= monitor.y + monitor.height - 1)
                insets.bottom = Math.max(insets.bottom, monitor.y + monitor.height - y);
        }
        const margin = this.settings.get_int('popup-margin');
        bin.style = `margin-left: ${Math.round(insets.left + margin)}px;` +
            ` margin-right: ${Math.round(insets.right + margin)}px;` +
            ` margin-bottom: ${Math.round(insets.bottom + margin)}px;`;
    }

    destroy() {
        global.display.disconnectObject(this);
        this._bannerBin?.disconnectObject(this);
        Main.messageTray.bannerAlignment = this._bannerAlignment;
        this._bannerBin?.set({
            y_align: this._bannerYAlign ?? Clutter.ActorAlign.START,
            style: null,
        });
        Main.uiGroup.remove_style_class_name('bzd-oneui');
        this.settings.disconnectObject(this);
        this._glass?.destroy();
        this._glass = null;
        this._magnifiers?.destroy();
        this._magnifiers = null;
        this._launch?.destroy();
        this._launch = null;
        this._icons.destroy();
        this._badges.destroy();
        super.destroy();
    }
}
