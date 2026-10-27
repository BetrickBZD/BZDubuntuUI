import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const DOCK_UUIDS = ['dash-to-dock@micxgx.gmail.com', 'ubuntu-dock@ubuntu.com'];
const DOCK_FILES = ['docking.js', 'appIcons.js', 'theming.js', 'utils.js'];

/**
 * Puts an item next to "Show Applications" in every dock of Ubuntu Dock or
 * Dash to Dock. Follows the dock being enabled, disabled or rebuilt (one dash
 * per monitor) and removes all items again on destroy().
 *
 * createItem(dash, dockModules) returns the actor to insert; dockModules are
 * the dock's own AppIcons, Theming and Utils modules. With after: true the
 * item goes behind "Show Applications" instead of between it and the apps.
 */
export class DockConnector {
    constructor(createItem, {after = false} = {}) {
        this._createItem = createItem;
        this._after = after;
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
        for (const {dash} of this._manager?._allDocks ?? []) {
            if (!dash || this._items.has(dash))
                continue;

            const item = this._createItem(dash, this._modules);
            this._insertNextToShowApps(dash, item);
            this._items.set(dash, item);
            item.connect('destroy', () => this._items.delete(dash));
        }
    }

    // Between the app icons and "Show Applications" (wherever that sits),
    // or behind it
    _insertNextToShowApps(dash, item) {
        const showApps = dash._showAppsIcon;
        const parent = showApps?.get_parent();
        if (!parent)
            dash._dashContainer.add_child(item);
        else if (this._after)
            this._keepBehind(parent, item, showApps);
        else if (parent.get_first_child() === showApps)
            parent.insert_child_above(item, showApps);
        else
            parent.insert_child_below(item, showApps);
    }

    // The dock moves "Show Applications" back to the edge whenever it
    // rebuilds, which would leave the item in front of it
    _keepBehind(parent, item, showApps) {
        parent.insert_child_above(item, showApps);
        const follow = () => {
            if (showApps.get_parent() === parent && item.get_previous_sibling() !== showApps)
                parent.set_child_above_sibling(item, showApps);
        };
        parent.connectObject(
            'notify::first-child', follow,
            'notify::last-child', follow,
            item);
    }

    _detachAll() {
        for (const item of [...this._items.values()])
            item.destroy();
        this._items.clear();
    }

    destroy() {
        Main.extensionManager.disconnectObject(this);
        this._unbind();
        this._createItem = null;
    }
}
