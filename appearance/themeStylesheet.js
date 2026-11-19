import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const RIM = 1; // px of the rim inside a surface's radius

/**
 * Loads a theme for the current shell style: the theme's stylesheet
 * template, filled with its values (@name@) and any computed ones given to
 * apply(), is written to the cache and handed to St like any extension
 * stylesheet. That happens only when the theme, the style or the computed
 * values change; nothing runs per frame.
 */
export class ThemeStylesheet {
    constructor(dir) {
        this._dir = dir;
        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'dock-media']);
        this._file = null;
        this._key = null;
    }

    // style: 'dark' or 'light'; values: computed ones, over the theme's own
    apply(theme, style, values = {}) {
        // Not while the shell starts: Ubuntu Dock follows theme changes
        // already then, but is on the stage only from 'startup-complete' on
        Main.layoutManager.disconnectObject(this);
        if (Main.layoutManager._startingUp) {
            Main.layoutManager.connectObject('startup-complete', () => this.apply(theme, style, values), this);
            return;
        }

        const computed = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA1,
            JSON.stringify(values), -1).slice(0, 12);
        const key = `${theme.id}-${style}-${computed}`;
        if (key === this._key)
            return;

        const template = Gio.File.new_for_path(
            GLib.build_filenamev([this._dir, 'appearance', 'themes', theme.stylesheet]));
        const [, bytes] = template.load_contents(null);
        const all = {...theme, ...theme[style], innerRadius: theme.radius - RIM, ...values};
        const css = new TextDecoder().decode(bytes).replace(/@([A-Za-z]+)@/g, (match, name) => {
            if (name in all)
                return String(all[name]);
            console.warn(`Dock Media: theme ${theme.id} has no value for ${match}`);
            return match;
        });

        GLib.mkdir_with_parents(this._cacheDir, 0o755);
        const file = Gio.File.new_for_path(GLib.build_filenamev([this._cacheDir, `theme-${key}.css`]));
        file.replace_contents(new TextEncoder().encode(css), null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION, null);

        this._unload();
        St.ThemeContext.get_for_stage(global.stage).get_theme().load_stylesheet(file);
        this._file = file;
        this._key = key;
    }

    _unload() {
        if (this._file)
            St.ThemeContext.get_for_stage(global.stage).get_theme().unload_stylesheet(this._file);
        this._file = null;
        this._key = null;
    }

    destroy() {
        Main.layoutManager.disconnectObject(this);
        this._unload();
    }
}
