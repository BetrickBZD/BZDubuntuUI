import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {mix, parseRgba, toCss} from '../lib/color.js';
import {DockConnector} from '../lib/dockConnector.js';
import {glassTargets} from '../lib/glassTargets.js';

import {GlassBackdrop} from './glassBackdrop.js';
import {DockGlassLayer} from './glassSurface.js';
import {LiveGlassSurface} from './liveGlass.js';
import {QuickSettingsGlass} from './quickSettingsGlass.js';
import {ThemeStylesheet} from './themeStylesheet.js';
import {resolveTheme} from './themes/index.js';
import {WindowGlass} from './windowGlass.js';

// Scope of the theme's stylesheet rules, on the UI root; the overview's
// rules only with 'glass-overview'
const GLASS_CLASS = 'bzd-glass';
const OVERVIEW_CLASS = 'bzd-glass-overview';
// Hover labels have no blur behind them, so the tint covers nearly all
const LABEL_ALPHA = 0.9;
// How much lighter the glass is at its top at full 'glass-shine'
const TOP_LIGHT = 0.22;
const WHITE = {red: 255, green: 255, blue: 255};
// Settings only the stylesheet's computed values depend on
const STYLE_SETTINGS = ['glass-shine', 'glass-tint-wallpaper', 'glass-tint-strength'];

// With 'glass-everywhere': GNOME Shell surfaces that get glass too, found by
// their style class (menus, dialogs like power off, volume/brightness OSD,
// window switcher, input method popup, notification banners, the dots
// when switching workspaces, the screenshot tool's panel and the size shown
// while resizing a window)
const SHELL_SURFACES = [
    'popup-menu-content',
    'modal-dialog',
    'osd-window',
    'switcher-list',
    'candidate-popup-content',
    'notification-banner',
    'workspace-switcher',
    'screenshot-ui-panel',
    'resize-popup',
];
const SCAN_DEPTH = 4;

/**
 * Liquid glass. Popups (the top bar's calendar and quick settings, every
 * popup in glassTargets and, with 'glass-everywhere', all other shell
 * surfaces) get a LiveGlassSurface that blurs whatever is behind them,
 * windows included, only while they are open. The docks are always visible
 * and nothing moves behind a fixed dock, so they get the static frosted
 * wallpaper instead, which costs nothing per frame; it is blurred and
 * darkened like the live blur, so both look alike. 'glass-mode' picks the
 * theme's tinted or clear variant; 'glass-shine' how much light the glass
 * catches at its top, 'glass-tint-wallpaper' and 'glass-tint-strength' how
 * much of the wallpaper's color it takes on, and 'glass-overview' whether
 * the overview's search and folders are glass too. Nothing of GNOME is
 * patched: new surfaces are recognized by their style class when they are
 * added. How it all looks comes from one theme (themes/), in the palette of
 * the shell's light or dark style; the theme's stylesheet only matches these
 * surfaces, so other extensions' widgets are untouched. Everything is
 * undone on destroy().
 */
export class LiquidGlass {
    constructor({settings, path}) {
        this._settings = settings;
        this._live = settings.get_boolean('glass-live');
        this._theme = resolveTheme('liquid-glass', settings.get_string('glass-mode'));
        this._stylesheet = new ThemeStylesheet(path);
        this._blur = null;
        Main.uiGroup.add_style_class_name(GLASS_CLASS);
        this._backdrop = new GlassBackdrop();
        this._surfaces = new Map(); // actor -> LiveGlassSurface
        this._pending = new Map(); // new actor -> later to look at it
        St.Settings.get().connectObject(
            'notify::color-scheme', () => this._queueStyle(),
            'notify::shell-color-scheme', () => this._queueStyle(),
            this);
        // The wallpaper's color arrives with the frosted wallpaper, which
        // the overview shows too
        this._backdrop.connectObject('changed', () => {
            this._queueStyle();
            this._syncOverview();
        }, this);
        Main.layoutManager.connectObject('monitors-changed', () => this._syncOverview(), this);
        for (const key of STYLE_SETTINGS)
            settings.connectObject(`changed::${key}`, () => this._queueStyle(), this);
        settings.connectObject('changed::glass-overview', () => this._syncOverview(), this);
        this._syncStyle();
        this._syncOverview();

        const {dateMenu, quickSettings} = Main.panel.statusArea;
        for (const menu of [dateMenu?.menu, quickSettings?.menu]) {
            if (menu)
                this._addSurface(menu.box);
        }
        this._quickSettings = new QuickSettingsGlass(quickSettings?.menu, this._theme.overlayBlur);
        for (const actor of glassTargets.actors)
            this._addSurface(actor);
        glassTargets.connectObject(
            'added', (_t, actor) => this._addSurface(actor),
            'removed', (_t, actor) => this._removeSurface(actor),
            this);

        if (settings.get_boolean('glass-everywhere'))
            this._watchShell();

        this._docks = new DockConnector(dash => new DockGlassLayer(dash, this._backdrop));
        this._windows = settings.get_boolean('window-glass')
            ? new WindowGlass(settings, this._backdrop, this._blur, this._theme.windowOpacity,
                this._live, {dark: this._theme.dark.windowTint, light: this._theme.light.windowTint}) : null;
    }

    // The theme's palette for the shell's light or dark style, like GNOME's
    // own stylesheets
    // Loading a stylesheet restyles the whole shell, so changes coming
    // together (a slider dragged, the style switched) apply once, before
    // the next frame
    _queueStyle() {
        if (this._styleLater)
            return;
        this._styleLater = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._styleLater = 0;
            this._syncStyle();
            return GLib.SOURCE_REMOVE;
        });
    }

    _syncStyle() {
        const style = Main.getStyleVariant() === 'light' ? 'light' : 'dark';
        const {blurRadius, saturation} = this._theme;
        const brightness = this._theme[style].blurBrightness;
        this._backdrop.setLook({blurRadius, saturation, brightness});
        // With the wallpaper's tint, wait for its color rather than load a
        // stylesheet without it just to load the next one a moment later
        const tint = this._settings.get_boolean('glass-tint-wallpaper');
        if (!tint || this._backdrop.color || !this._backdrop.pending)
            this._stylesheet.apply(this._theme, style, this._computedValues(style));
        this._blur = {radius: blurRadius, brightness};
        for (const surface of this._surfaces.values())
            surface.setBlur(this._blur);
        this._windows?.setBlur(this._blur);
    }

    // The palette's tints with a share of the wallpaper's color, lighter at
    // the top, and the top edge's light, as strong as the settings say
    _computedValues(style) {
        const palette = this._theme[style];
        const shine = this._settings.get_int('glass-shine') / 100;
        const wallpaper = this._settings.get_boolean('glass-tint-wallpaper') ? this._backdrop.color : null;
        const share = wallpaper ? this._settings.get_int('glass-tint-strength') / 100 : 0;
        const tinted = name => {
            const color = parseRgba(palette[name]);
            return wallpaper ? mix(color, wallpaper, share) : color;
        };
        const top = color => mix(color, WHITE, TOP_LIGHT * shine);
        const light = name => {
            const color = parseRgba(palette[name]);
            return toCss({...color, alpha: color.alpha * shine});
        };

        const surface = tinted('surface');
        const dock = tinted('dock');
        const osd = tinted('osd');
        return {
            surface: toCss(surface),
            surfaceTop: toCss(top(surface)),
            osd: toCss(osd),
            osdTop: toCss(top(osd)),
            dock: toCss(dock),
            dockTop: toCss(top(dock)),
            overlay: toCss(tinted('overlay')),
            label: toCss({...dock, alpha: Math.max(dock.alpha, LABEL_ALPHA)}),
            shine: light('shine'),
            dockShine: light('dockShine'),
        };
    }

    // With 'glass-overview' the overview and the app grid lie on the
    // frosted wallpaper, like everything else of glass, instead of the
    // theme's flat grey; on the primary monitor, which it is made for
    _syncOverview() {
        const glass = this._settings.get_boolean('glass-overview');
        if (glass)
            Main.uiGroup.add_style_class_name(OVERVIEW_CLASS);
        else
            Main.uiGroup.remove_style_class_name(OVERVIEW_CLASS);

        const group = Main.layoutManager.overviewGroup;
        const monitor = Main.layoutManager.primaryMonitor;
        const path = this._backdrop.path;
        group.style = glass && path && monitor
            ? `background-image: url("${path}");` +
              ` background-size: ${monitor.width}px ${monitor.height}px;` +
              ` background-position: ${monitor.x}px ${monitor.y}px;`
            : null;
    }

    // Menus, OSDs and switchers are added to the UI root, dialogs to their
    // group, notification banners to the message tray's banner bin
    _watchShell() {
        const containers = [Main.uiGroup, Main.layoutManager.modalDialogGroup, Main.messageTray._bannerBin];
        for (const container of containers.filter(Boolean)) {
            container.connectObject('child-added', (_c, child) => this._queueScan(child), this);
            for (const child of container.get_children())
                this._scan(child);
        }
    }

    // A new actor is looked at before the next frame, once its owner has set
    // it up: some fill it only after adding it, and menus are added shown
    // and hidden right after
    _queueScan(root) {
        if (this._pending.has(root))
            return;
        const id = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._forget(root);
            if (root.get_parent())
                this._scan(root);
            return GLib.SOURCE_REMOVE;
        });
        this._pending.set(root, id);
        // Gone before it was looked at: never touch it again
        root.connectObject('destroy', () => this._forget(root, true), this);
    }

    _scan(root) {
        if (root === global.window_group || root === global.top_window_group)
            return;
        for (const actor of findSurfaces(root, 0, []))
            this._addSurface(actor);
    }

    _forget(root, cancel = false) {
        const id = this._pending.get(root);
        this._pending.delete(root);
        root.disconnectObject(this);
        if (cancel)
            global.compositor.get_laters().remove(id);
    }

    _addSurface(actor) {
        if (this._surfaces.has(actor))
            return;
        const surface = new LiveGlassSurface(actor, {backdrop: this._backdrop, live: this._live});
        surface.setBlur(this._blur);
        this._surfaces.set(actor, surface);
        actor.connectObject('destroy', () => this._removeSurface(actor), this);
    }

    _removeSurface(actor) {
        actor.disconnectObject(this);
        this._surfaces.get(actor)?.destroy();
        this._surfaces.delete(actor);
    }

    destroy() {
        if (this._styleLater)
            global.compositor.get_laters().remove(this._styleLater);
        this._styleLater = 0;
        for (const root of [...this._pending.keys()])
            this._forget(root, true);

        glassTargets.disconnectObject(this);
        Main.uiGroup.disconnectObject(this);
        Main.messageTray._bannerBin?.disconnectObject(this);
        Main.layoutManager.modalDialogGroup.disconnectObject(this);
        this._docks.destroy();
        this._windows?.destroy();
        this._quickSettings.destroy();
        for (const actor of [...this._surfaces.keys()])
            this._removeSurface(actor);
        this._backdrop.disconnectObject(this);
        this._backdrop.destroy();
        this._settings.disconnectObject(this);
        St.Settings.get().disconnectObject(this);
        this._stylesheet.destroy();
        Main.uiGroup.remove_style_class_name(GLASS_CLASS);
        Main.uiGroup.remove_style_class_name(OVERVIEW_CLASS);
        Main.layoutManager.disconnectObject(this);
        Main.layoutManager.overviewGroup.style = null;
    }
}

// Shell surfaces in and below `actor`, not looking inside a found one
function findSurfaces(actor, depth, found) {
    if (actor instanceof St.Widget && SHELL_SURFACES.some(name => actor.has_style_class_name(name))) {
        found.push(actor);
        return found;
    }
    if (depth < SCAN_DEPTH) {
        for (const child of actor.get_children())
            findSurfaces(child, depth + 1, found);
    }
    return found;
}
