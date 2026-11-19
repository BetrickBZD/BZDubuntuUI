/**
 * Base class of all modules. A module starts in its constructor and undoes
 * everything in destroy(). It gets the extension's settings and directory
 * and can open the preferences window.
 */
export class Module {
    constructor(extension) {
        this._extension = extension;
        this.settings = extension.getSettings();
    }

    get path() {
        return this._extension.path;
    }

    openPreferences() {
        this._extension.openPreferences();
    }

    destroy() {
        this.settings = null;
        this._extension = null;
    }
}
