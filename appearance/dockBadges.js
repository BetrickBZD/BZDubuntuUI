import {brightness} from '../lib/color.js';

const BADGE_CLASS = 'notification-badge';
const DOT_CLASS = 'bzd-badge-dot';
// A dot's diameter, of the icon size
const DOT_SHARE = 0.24;
// The settings this follows
const KEYS = ['dock-badge-style', 'dock-badge-color-mode', 'dock-badge-color'];

/**
 * The dock's notification badges (the count on an app icon) as the
 * settings say: a number as usual, a plain dot or none at all
 * ('dock-badge-style'), in the theme's color, the accent color or an own
 * one ('dock-badge-color-mode', 'dock-badge-color'). The dock creates a
 * badge, a bin around a 'notification-badge' label, in an icon's container
 * whenever a count appears, and sets the label's inline style itself (its
 * font size): our color is added to whatever it sets. A hidden badge only
 * has its label made invisible, so the bin stays the dock's to show and the
 * zoom (DockMagnifier) can hide it. Everything goes back on destroy().
 */
export class DockBadges {
    constructor(dash, settings) {
        this._dash = dash;
        this._settings = settings;
        this._badges = new Map(); // label -> {bin, base: the dock's style, applied}
        this._containers = new Set();
        const box = dash._box;
        if (!box)
            return;

        box.connectObject(
            'child-added', (_b, item) => this._watchItem(item),
            this);
        box.get_children().forEach(item => this._watchItem(item));
        dash.connectObject(
            'icon-size-changed', () => this._restyleAll(),
            // Gone before us (screen lock, dock rebuilt): nothing to restore
            'destroy', () => {
                this._dash = null;
                this._badges.clear();
                this._containers.clear();
            },
            this);
        for (const key of KEYS)
            settings.connectObject(`changed::${key}`, () => this._restyleAll(), this);
    }

    // App icons have their badges in their icon container
    _watchItem(item) {
        const container = item.child?._iconContainer;
        if (!container || this._containers.has(container))
            return;
        this._containers.add(container);
        container.connectObject(
            'child-added', (_c, child) => this._watchBadge(child),
            'destroy', () => this._containers.delete(container),
            this);
        container.get_children().forEach(child => this._watchBadge(child));
    }

    _watchBadge(bin) {
        const label = bin.child;
        if (!label?.has_style_class_name?.(BADGE_CLASS) || this._badges.has(label))
            return;
        this._badges.set(label, {bin, base: label.style ?? '', applied: null});
        // The dock sets its style anew on theme or size changes
        label.connectObject(
            'notify::style', () => this._restyle(label),
            'destroy', () => this._badges.delete(label),
            this);
        this._restyle(label);
    }

    _restyleAll() {
        for (const label of this._badges.keys())
            this._restyle(label);
    }

    _restyle(label) {
        const badge = this._badges.get(label);
        if (!badge || !this._dash)
            return;
        // A style that isn't ours is the dock's own, new one
        if ((label.style ?? '') !== badge.applied)
            badge.base = label.style ?? '';

        const style = this._settings.get_string('dock-badge-style');
        label.opacity = style === 'hidden' ? 0 : 255;
        if (style === 'dot') {
            const size = Math.max(6, Math.round(this._dash.iconSize * DOT_SHARE));
            label.add_style_class_name(DOT_CLASS);
            label.set_size(size, size);
        } else {
            label.remove_style_class_name(DOT_CLASS);
            label.set_size(-1, -1);
        }

        // A dot shows no count: its text stays transparent whatever the color
        const text = style === 'dot' ? ' color: transparent;' : '';
        const applied = `${badge.base}${badge.base && !badge.base.trim().endsWith(';') ? ';' : ''}${this._colorStyle()}${text}`;
        badge.applied = applied;
        if (label.style !== applied)
            label.style = applied;
    }

    // Background, rim and text color, or nothing for the theme's own
    _colorStyle() {
        switch (this._settings.get_string('dock-badge-color-mode')) {
        case 'accent':
            return ' background-color: -st-accent-color; border-color: -st-accent-color;' +
                ' color: -st-accent-fg-color;';
        case 'custom': {
            const color = parseHex(this._settings.get_string('dock-badge-color'));
            if (!color)
                return '';
            const hex = this._settings.get_string('dock-badge-color');
            const text = brightness(color) > 0.6 ? 'black' : 'white';
            return ` background-color: ${hex}; border-color: ${hex}; color: ${text};`;
        }
        default:
            return '';
        }
    }

    destroy() {
        this._settings.disconnectObject(this);
        if (!this._dash)
            return;
        this._dash.disconnectObject(this);
        this._dash._box?.disconnectObject(this);
        for (const container of this._containers)
            container.disconnectObject(this);
        for (const [label, {base}] of this._badges) {
            label.disconnectObject(this);
            label.remove_style_class_name(DOT_CLASS);
            label.set_size(-1, -1);
            label.opacity = 255;
            label.style = base || null;
        }
        this._badges.clear();
        this._containers.clear();
        this._dash = null;
    }
}

// '#rrggbb' as {red, green, blue}, or null
function parseHex(text) {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(text.trim());
    if (!match)
        return null;
    const [red, green, blue] = match.slice(1).map(part => parseInt(part, 16));
    return {red, green, blue};
}
