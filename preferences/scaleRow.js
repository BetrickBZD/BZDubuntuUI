import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

/**
 * A row with a wide slider for an integer setting with a range, the value
 * next to it (format(value), e.g. "150 %") and a button that puts the
 * default back; a mark on the slider shows where the default is. Range and
 * default come from the schema.
 */
export function scaleRow(settings, key, {title, subtitle = null, step = 1, format = value => `${value}`}) {
    const schemaKey = settings.settings_schema.get_key(key);
    const [, [min, max]] = schemaKey.get_range().recursiveUnpack();
    const fallback = schemaKey.get_default_value().unpack();

    const row = new Adw.ActionRow({title, subtitle});
    const adjustment = new Gtk.Adjustment({
        lower: min,
        upper: max,
        step_increment: step,
        page_increment: step * 5,
    });
    const scale = new Gtk.Scale({
        adjustment,
        draw_value: false,
        digits: 0,
        round_digits: 0,
        hexpand: true,
        width_request: 160,
        valign: Gtk.Align.CENTER,
    });
    scale.add_mark(fallback, Gtk.PositionType.BOTTOM, null);
    settings.bind(key, adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);

    const label = new Gtk.Label({
        width_chars: 6,
        xalign: 1,
        valign: Gtk.Align.CENTER,
        css_classes: ['numeric', 'dim-label'],
    });
    const reset = new Gtk.Button({
        icon_name: 'edit-undo-symbolic',
        tooltip_text: `Standard (${format(fallback)})`,
        valign: Gtk.Align.CENTER,
        css_classes: ['flat', 'circular'],
    });
    reset.connect('clicked', () => settings.reset(key));

    const sync = () => {
        const value = settings.get_int(key);
        label.label = format(value);
        reset.sensitive = value !== fallback;
    };
    const id = settings.connect(`changed::${key}`, sync);
    row.connect('destroy', () => settings.disconnect(id));
    sync();

    row.add_suffix(scale);
    row.add_suffix(label);
    row.add_suffix(reset);
    return row;
}

/**
 * A row with linked toggle buttons, one per choice ([value, label] pairs)
 * of a string setting, like a segmented control.
 */
export function choiceRow(settings, key, choices, {title, subtitle = null}) {
    const row = new Adw.ActionRow({title, subtitle});
    const box = new Gtk.Box({css_classes: ['linked'], valign: Gtk.Align.CENTER});
    let group = null;
    const buttons = choices.map(([value, label]) => {
        const button = new Gtk.ToggleButton({label, group});
        group ??= button;
        button.connect('toggled', () => {
            if (button.active && settings.get_string(key) !== value)
                settings.set_string(key, value);
        });
        box.append(button);
        return [value, button];
    });
    const sync = () => {
        const current = settings.get_string(key);
        for (const [value, button] of buttons)
            button.active = value === current;
    };
    const id = settings.connect(`changed::${key}`, sync);
    row.connect('destroy', () => settings.disconnect(id));
    sync();
    row.add_suffix(box);
    return row;
}

/**
 * A row with a color button for a '#rrggbb' string setting, opening GTK's
 * color chooser.
 */
export function colorRow(settings, key, {title, subtitle = null}) {
    const row = new Adw.ActionRow({title, subtitle});
    const button = new Gtk.ColorDialogButton({
        dialog: new Gtk.ColorDialog({title, with_alpha: false}),
        valign: Gtk.Align.CENTER,
    });
    const sync = () => {
        const rgba = new Gdk.RGBA();
        if (rgba.parse(settings.get_string(key)) && !rgba.equal(button.rgba))
            button.rgba = rgba;
    };
    button.connect('notify::rgba', () => {
        const {red, green, blue} = button.rgba;
        const hex = `#${[red, green, blue].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
        if (settings.get_string(key) !== hex)
            settings.set_string(key, hex);
    });
    const id = settings.connect(`changed::${key}`, sync);
    row.connect('destroy', () => settings.disconnect(id));
    sync();
    row.add_suffix(button);
    row.activatable_widget = button;
    return row;
}

/** A switch row bound to a boolean setting. */
export function switchRow(settings, key, {title, subtitle = null}) {
    const row = new Adw.SwitchRow({title, subtitle});
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

/** Greys `widget` out while the boolean setting `key` is off. */
export function dependsOn(settings, key, widget) {
    settings.bind(key, widget, 'sensitive', Gio.SettingsBindFlags.GET);
    return widget;
}
