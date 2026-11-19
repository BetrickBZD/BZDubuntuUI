import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const DOCK_UUIDS = ['dash-to-dock@micxgx.gmail.com', 'ubuntu-dock@ubuntu.com'];
const DOCK_FILES = ['docking.js', 'appIcons.js', 'theming.js', 'utils.js'];

// Items kept next to "Show Applications", from all connectors: their side
// of it and their place in line there, by order and then by arrival
const lineUpPlaces = new WeakMap();
let arrivals = 0;
// Items at the very start of the dock (start: true)
const startItems = new WeakSet();

/**
 * Creates an item for every dock of Ubuntu Dock or Dash to Dock. Follows the
 * dock being enabled, disabled or rebuilt (one dash per monitor) and destroys
 * all items again on destroy().
 *
 * createItem(dash, dockModules, {main}) returns either an actor, which is
 * put next to "Show Applications", or any object with destroy() that only
 * changes the dash, or null for none. dockModules are the dock's own
 * AppIcons, Theming and Utils modules; main is true for the dock on the
 * dock's preferred monitor. Actors go between the apps and "Show
 * Applications", the highest `order` right next to it, or with after: true
 * behind it, the lowest `order` right behind it; they line up with those
 * of other connectors. With start: true at the very start of the dock.
 */
export class DockConnector {
    constructor(createItem, {after = false, start = false, order = 0} = {}) {
        this._createItem = createItem;
        this._after = after;
        this._start = start;
        this._order = order;
        this._items = new Map();
        this._manager = null;
        this._modules = null;
        this._signals = [];

        Main.extensionManager.connectObject('extension-state-changed', (_m, ext) => {
            if (DOCK_UUIDS.includes(ext.uuid))
                this._bind().catch(logError);
        }, this);
        this._bind().catch(logError);
    }

    async _bind() {
        const ext = DOCK_UUIDS
            .map(uuid => Main.extensionManager.lookup(uuid))
            .find(e => e?.stateObj && e.dir);

        let manager = null;
        let modules = null;
        if (ext) {
            const [Docking, AppIcons, Theming, Utils] = await Promise.all(
                DOCK_FILES.map(f => import(ext.dir.get_child(f).get_uri())));
            manager = Docking.DockManager.getDefault() ?? null;
            modules = {AppIcons, Theming, Utils};
        }

        // Destroyed while awaiting the imports, or nothing changed
        if (!this._createItem || manager === this._manager)
            return;

        this._unbind();
        if (!manager)
            return;

        this._manager = manager;
        this._modules = modules;
        this._signals = [
            manager.connect('docks-ready', () => this._attachAll()),
            manager.connect('docks-destroyed', () => this._detachAll()),
        ];
        this._attachAll();
    }

    _unbind() {
        this._detachAll();
        for (const id of this._signals)
            this._manager?.disconnect(id);
        this._signals = [];
        this._manager = null;
    }

    _attachAll() {
        // While the shell starts the docks aren't on the stage yet: items
        // added then make the dock look up styles it can't have yet, once
        // per item and each of its parents (hundreds of warnings at login)
        if (Main.layoutManager._startingUp) {
            Main.layoutManager.connectObject('startup-complete', () => {
                Main.layoutManager.disconnectObject(this);
                this._attachAll();
            }, this);
            return;
        }
        const mainDock = this._manager?.mainDock;
        for (const dock of this._manager?._allDocks ?? []) {
            const {dash} = dock;
            if (!dash || this._items.has(dash))
                continue;

            const item = this._createItem(dash, this._modules, {main: dock === mainDock});
            if (!item)
                continue;
            this._items.set(dash, item);
            if (item instanceof Clutter.Actor) {
                if (this._start) {
                    startItems.add(item);
                    dash._dashContainer.insert_child_at_index(item, 0);
                } else {
                    this._insertNextToShowApps(dash, item);
                }
                item.connect('destroy', () => this._items.delete(dash));
            }
        }
    }

    // The dock moves "Show Applications" back to the edge whenever it
    // rebuilds, which would leave items on the wrong side of it
    _insertNextToShowApps(dash, item) {
        const showApps = dash._showAppsIcon;
        const parent = showApps?.get_parent();
        if (!parent) {
            dash._dashContainer.add_child(item);
            return;
        }

        lineUpPlaces.set(item, {after: this._after, order: this._order, arrival: arrivals++});
        parent.insert_child_above(item, showApps);
        const follow = () => lineUp(parent, showApps);
        parent.connectObject(
            'notify::first-child', follow,
            'notify::last-child', follow,
            item);
        follow();
    }

    _detachAll() {
        for (const item of [...this._items.values()])
            item.destroy();
        this._items.clear();
    }

    destroy() {
        Main.extensionManager.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
        this._unbind();
        this._createItem = null;
    }
}

// All items right next to "Show Applications", in their order: those in
// front of it towards the apps, the others behind it towards the dock's
// edge. With "Show Applications" at the top of the dock (Dash to Dock can
// do that) both sides swap.
function lineUp(parent, showApps) {
    if (showApps.get_parent() !== parent)
        return;

    const placed = parent.get_children().filter(child => lineUpPlaces.has(child));
    const atTop = parent.get_children()
        .find(child => !lineUpPlaces.has(child) && !startItems.has(child)) === showApps;
    const side = after => placed
        .map(child => [child, lineUpPlaces.get(child)])
        .filter(([, place]) => place.after === after)
        .sort(([, a], [, b]) => a.order - b.order || a.arrival - b.arrival)
        .map(([child]) => child);
    // Towards the apps: the highest order right next to it
    const front = side(false).reverse();
    // Towards the edge: the lowest order right next to it
    const back = side(true);

    let next = showApps;
    for (const item of atTop ? back : front) {
        if (item.get_next_sibling() !== next)
            parent.set_child_below_sibling(item, next);
        next = item;
    }
    let previous = showApps;
    for (const item of atTop ? front : back) {
        if (item.get_previous_sibling() !== previous)
            parent.set_child_above_sibling(item, previous);
        previous = item;
    }
}
