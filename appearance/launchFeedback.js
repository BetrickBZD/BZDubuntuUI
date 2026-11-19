import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

// How far an icon hops away from the screen edge, of the icon size: little
// enough that the dock, which clips its icons, still shows it all
const HOP_SHARE = 0.2;
const UP = 220; // ms
const DOWN = 380; // ms
// An app that shows no window in this time is taken as started anyway
const LAUNCH_TIMEOUT = 12; // s
// Windows that mark an app as started
const WINDOW_TYPES = [Meta.WindowType.NORMAL, Meta.WindowType.DIALOG];

/**
 * Feedback while an app starts from one dash, like the macOS dock: a click
 * that starts an app which isn't running makes its icon hop away from the
 * screen edge until the app's first window shows (or LAUNCH_TIMEOUT
 * passes). As GNOME doesn't always tell a starting app's window apart
 * (snaps, apps whose window names another app), any new window counts. Many apps, Electron ones among them, don't announce their start,
 * so GNOME starts another copy on every click meanwhile: further plain
 * clicks on the icon are stopped while it hops, before the dock's icon
 * acts on them (its own click handling runs last). Ctrl+click, which asks
 * for another window on purpose, still goes through. Nothing runs while no
 * app is starting.
 */
export class LaunchFeedback {
    constructor(dash, dockModules) {
        this._dash = dash;
        this._box = dash._box;
        this._tracked = new Map(); // dash item -> {button, icon, app, launching, timeoutId}
        if (!this._box)
            return;

        const side = dockModules?.Utils?.getPosition?.() ?? St.Side.LEFT;
        this._direction = {
            [St.Side.LEFT]: [1, 0],
            [St.Side.RIGHT]: [-1, 0],
            [St.Side.TOP]: [0, 1],
            [St.Side.BOTTOM]: [0, -1],
        }[side] ?? [1, 0];

        this._box.connectObject(
            'child-added', (_b, item) => this._track(item),
            'child-removed', (_b, item) => this._untrack(item),
            this);
        // Gone before us (screen lock, dock rebuilt): nothing to restore
        dash.connectObject('destroy', () => {
            for (const tracked of this._tracked.values())
                this._stopTimeout(tracked);
            this._tracked.clear();
            this._box = null;
            this._dash = null;
        }, this);
        this._box.get_children().forEach(item => this._track(item));
    }

    // App icons only: their button knows its app
    _track(item) {
        const button = item.child;
        const app = button?.app;
        const icon = button?.icon;
        if (!app || !icon || this._tracked.has(item))
            return;

        const tracked = {button, icon, app, launching: false, timeoutId: 0};
        button.connectObject('clicked', (_b, mouseButton) => this._onClicked(tracked, mouseButton), this);
        app.connectObject(
            'windows-changed', () => {
                if (app.get_n_windows() > 0)
                    this._stopLaunch(tracked);
            },
            'notify::state', () => {
                if (app.state === Shell.AppState.RUNNING)
                    this._stopLaunch(tracked);
            },
            this);
        // The dock often destroys an icon before reporting it removed
        icon.connectObject('destroy', () => this._untrack(item, false), this);
        this._tracked.set(item, tracked);
    }

    _untrack(item, alive = true) {
        const tracked = this._tracked.get(item);
        if (!tracked)
            return;
        this._tracked.delete(item);
        this._stopTimeout(tracked);
        tracked.app.disconnectObject(this);
        if (!alive)
            return;
        tracked.button.disconnectObject(this);
        tracked.icon.disconnectObject(this);
        tracked.icon.disconnectObject(tracked);
        tracked.icon.remove_all_transitions();
        tracked.icon.set_translation(0, 0, 0);
    }

    // Runs before the dock's icon acts on the click: that is the button's
    // own class handler, which comes last
    _onClicked(tracked, mouseButton) {
        const modifiers = Clutter.get_current_event()?.get_state() ?? 0;
        if (mouseButton !== Clutter.BUTTON_PRIMARY || modifiers & Clutter.ModifierType.CONTROL_MASK)
            return;

        if (tracked.launching) {
            // Still starting: no second copy
            GObject.signal_stop_emission_by_name(tracked.button, 'clicked');
            return;
        }
        // The click starts the app only if it isn't running yet
        if (tracked.app.state === Shell.AppState.STOPPED && tracked.app.get_n_windows() === 0)
            this._startLaunch(tracked);
    }

    _startLaunch(tracked) {
        tracked.launching = true;
        // Any new window ends all hopping: GNOME may count it to another app
        global.display.connectObject('window-created', (_d, window) => {
            if (WINDOW_TYPES.includes(window.get_window_type())) {
                for (const other of this._tracked.values())
                    this._stopLaunch(other);
            }
        }, this);
        this._stopTimeout(tracked);
        tracked.timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, LAUNCH_TIMEOUT, () => {
            tracked.timeoutId = 0;
            this._stopLaunch(tracked);
            return GLib.SOURCE_REMOVE;
        });
        this._hop(tracked);
    }

    // The current hop still lands; then it stays down
    _stopLaunch(tracked) {
        tracked.launching = false;
        this._stopTimeout(tracked);
        tracked.icon.disconnectObject(tracked);
        if (!hopping(tracked.icon))
            tracked.icon.set_translation(0, 0, 0);
        if (![...this._tracked.values()].some(other => other.launching))
            global.display.disconnectObject(this);
    }

    _stopTimeout(tracked) {
        if (tracked.timeoutId)
            GLib.source_remove(tracked.timeoutId);
        tracked.timeoutId = 0;
    }

    // Out quickly, back with a bounce, again while the app is starting.
    // Only while the hop can really play: with animations off, or while the
    // icon isn't on screen, an ease ends at once, and hopping on from its end
    // went round without end, until 'too much recursion' broke it off with
    // the icon left up in the air and the click lost. Then it waits until
    // the icon shows again. However a hop ends, the icon comes down.
    _hop(tracked) {
        const {icon} = tracked;
        icon.disconnectObject(tracked);
        if (!tracked.launching || !this._dash)
            return;
        const distance = Math.round(this._dash.iconSize * HOP_SHARE);
        if (!icon.mapped || !St.Settings.get().enable_animations || distance <= 0) {
            icon.set_translation(0, 0, 0);
            icon.connectObject('notify::mapped', () => {
                if (icon.mapped)
                    this._hop(tracked);
            }, tracked);
            return;
        }
        icon.ease({
            translation_x: this._direction[0] * distance,
            translation_y: this._direction[1] * distance,
            duration: UP,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => icon.ease({
                translation_x: 0,
                translation_y: 0,
                duration: DOWN,
                mode: Clutter.AnimationMode.EASE_OUT_BOUNCE,
                onStopped: finished => {
                    if (finished)
                        this._hop(tracked);
                    else if (!hopping(icon))
                        icon.set_translation(0, 0, 0);
                },
            }),
        });
    }

    destroy() {
        global.display.disconnectObject(this);
        this._dash?.disconnectObject(this);
        this._box?.disconnectObject(this);
        for (const item of [...this._tracked.keys()])
            this._untrack(item);
        this._box = null;
        this._dash = null;
    }
}

// Whether the icon is in the middle of a hop
function hopping(icon) {
    return Boolean(icon.get_transition('translation-x') || icon.get_transition('translation-y'));
}
