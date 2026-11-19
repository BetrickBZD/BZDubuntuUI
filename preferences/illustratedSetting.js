import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

/**
 * Card like in GNOME Settings' multitasking page: title, subtitle and a
 * switch for a boolean setting, or a dropdown for a string setting with
 * choices ([value, label] pairs), or nothing without a key, with an
 * illustration below and, if given, `rows` (switches, sliders …) for its
 * finer settings under it.
 *
 * draw(cr, width, height, colors, settings) paints the illustration; colors
 * are the accent and foreground color. It is redrawn when the settings, the
 * accent color or dark mode change, so it always shows the current state;
 * also when any of `redrawOn` (other Gio.Settings it shows) change.
 */
export const IllustratedSetting = GObject.registerClass(
class IllustratedSetting extends Gtk.Box {
    _init({title, subtitle, settings, key = null, choices = null, draw, rows = [], redrawOn = []}) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            css_classes: ['card'],
        });

        const header = new Gtk.Box({spacing: 12, margin_top: 12, margin_start: 12, margin_end: 12});
        const labels = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });
        labels.append(new Gtk.Label({label: title, xalign: 0}));
        labels.append(new Gtk.Label({
            label: subtitle,
            xalign: 0,
            wrap: true,
            css_classes: ['dim-label', 'caption'],
        }));
        header.append(labels);

        if (key) {
            header.append(choices
                ? dropDown(settings, key, choices)
                : switchFor(settings, key));
        }
        this.append(header);

        const area = new Gtk.DrawingArea({content_height: 170});
        area.set_draw_func((_a, cr, width, height) => {
            const colors = {
                accent: Adw.StyleManager.get_default().get_accent_color_rgba(),
                fg: area.get_color(),
            };
            draw(cr, width, height, colors, settings);
            cr.$dispose();
        });
        this.append(new Gtk.Frame({
            child: area,
            margin_start: 12,
            margin_end: 12,
            margin_bottom: rows.length ? 0 : 12,
        }));

        if (rows.length) {
            const list = new Gtk.ListBox({
                css_classes: ['boxed-list'],
                selection_mode: Gtk.SelectionMode.NONE,
                margin_start: 12,
                margin_end: 12,
                margin_bottom: 12,
            });
            for (const row of rows)
                list.append(row);
            this.append(list);
        }

        const redraw = () => area.queue_draw();
        const style = Adw.StyleManager.get_default();
        const ids = [
            [settings, settings.connect('changed', redraw)],
            [style, style.connect('notify::accent-color-rgba', redraw)],
            [style, style.connect('notify::dark', redraw)],
            ...redrawOn.map(other => [other, other.connect('changed', redraw)]),
        ];
        this.connect('destroy', () => ids.forEach(([obj, id]) => obj.disconnect(id)));
    }
});

function switchFor(settings, key) {
    const toggle = new Gtk.Switch({valign: Gtk.Align.CENTER});
    settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    return toggle;
}

function dropDown(settings, key, choices) {
    const values = choices.map(([value]) => value);
    const dropDown = Gtk.DropDown.new_from_strings(choices.map(([, label]) => label));
    dropDown.valign = Gtk.Align.CENTER;
    const sync = () => (dropDown.selected = Math.max(0, values.indexOf(settings.get_string(key))));
    const id = settings.connect(`changed::${key}`, sync);
    sync();
    dropDown.connect('notify::selected', () => {
        const value = values[dropDown.selected];
        if (value !== undefined && settings.get_string(key) !== value)
            settings.set_string(key, value);
    });
    dropDown.connect('destroy', () => settings.disconnect(id));
    return dropDown;
}
