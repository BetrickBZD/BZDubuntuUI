import cairo from 'cairo';
import Gio from 'gi://Gio';

/**
 * Illustrations for the IllustratedSetting cards, drawn in the accent color
 * like the ones in GNOME Settings: a screen outline with the dock on the
 * left and whatever the setting changes.
 */

function setColor(cr, color, alpha = 1) {
    cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha * alpha);
}

function roundedRect(cr, x, y, width, height, radius) {
    cr.newSubPath();
    cr.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0);
    cr.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
    cr.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
    cr.arc(x + radius, y + radius, radius, Math.PI, 3 * Math.PI / 2);
    cr.closePath();
}

// Screen outline, optionally with the top bar; returns its geometry
function drawScreen(cr, width, height, {accent}, {topBar = true} = {}) {
    const w = Math.min(width - 48, 220);
    const h = Math.round(w * 0.58);
    const screen = {x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), w, h};

    setColor(cr, accent);
    cr.setLineWidth(1.5);
    cr.rectangle(screen.x, screen.y, w, h);
    cr.stroke();
    if (topBar) {
        cr.rectangle(screen.x, screen.y, w, 6);
        cr.fill();
    }
    screen.top = screen.y + (topBar ? 6 : 0);
    return screen;
}

// Dock on the left with app icons, an optional cover and "Show Applications".
// paint(box) fills the dock's outline, by default in a light accent.
function drawDock(cr, screen, {accent}, {cover = false, paint = null} = {}) {
    const dock = {x: screen.x + 4, y: screen.top + 4, w: 16, h: screen.y + screen.h - screen.top - 8};
    roundedRect(cr, dock.x, dock.y, dock.w, dock.h, 4);
    if (paint) {
        paint(dock);
    } else {
        setColor(cr, accent, 0.25);
        cr.fill();
    }

    setColor(cr, accent, 0.7);
    for (let i = 0; i < 3; i++) {
        roundedRect(cr, dock.x + 3, dock.y + 4 + i * 13, 10, 10, 2);
        cr.fill();
    }

    // "Show Applications": a 3x3 grid of dots
    dock.showAppsY = dock.y + dock.h - 26;
    for (let i = 0; i < 9; i++) {
        cr.arc(dock.x + 5 + (i % 3) * 3, dock.showAppsY + 2 + Math.floor(i / 3) * 3, 0.9, 0, 2 * Math.PI);
        cr.fill();
    }

    if (cover) {
        setColor(cr, accent);
        dock.coverY = dock.showAppsY - 14;
        roundedRect(cr, dock.x + 3, dock.coverY, 10, 10, 2);
        cr.fill();
    }
    return dock;
}

// Popup card next to the dock, top aligned with `top`, kept inside the
// screen; paint(box) fills its outline
function drawPopup(cr, screen, dock, top, margin, paint) {
    const w = Math.round(screen.w * 0.4);
    const h = Math.round(screen.h * 0.42);
    const x = dock.x + dock.w + margin;
    const y = Math.min(top, screen.y + screen.h - margin - h);
    roundedRect(cr, x, y, w, h, 5);
    paint({x, y, w, h});
    return {x, y, w, h};
}

// Small cover, two text lines and three control dots inside a popup
function drawPopupContent(cr, popup, color) {
    setColor(cr, color, 0.9);
    roundedRect(cr, popup.x + 6, popup.y + 6, 14, 14, 2);
    cr.fill();
    setColor(cr, color, 0.6);
    cr.rectangle(popup.x + 24, popup.y + 8, popup.w * 0.45, 3);
    cr.rectangle(popup.x + 24, popup.y + 14, popup.w * 0.3, 3);
    cr.fill();
    for (let i = -1; i <= 1; i++) {
        cr.arc(popup.x + popup.w / 2 + i * 10, popup.y + popup.h - 9, 2, 0, 2 * Math.PI);
        cr.fill();
    }
}

// Glossy glass fill: lighter at the top, bright rim; clear glass is barely
// filled, with a brighter rim
function glassPaint(cr, {fg}, box, clear = false) {
    const gradient = new cairo.LinearGradient(0, box.y, 0, box.y + box.h);
    gradient.addColorStopRGBA(0, fg.red, fg.green, fg.blue, clear ? 0.14 : 0.35);
    gradient.addColorStopRGBA(1, fg.red, fg.green, fg.blue, clear ? 0.02 : 0.06);
    cr.setSource(gradient);
    cr.fillPreserve();
    setColor(cr, fg, clear ? 0.75 : 0.55);
    cr.setLineWidth(1);
    cr.stroke();
}

/** Media popup: blurred cover background and popup-margin to the dock */
export function drawMediaPopup(cr, width, height, colors, settings) {
    const {accent, fg} = colors;
    const screen = drawScreen(cr, width, height, colors);
    const dock = drawDock(cr, screen, colors, {cover: true});
    const margin = 2 + settings.get_int('popup-margin') * 0.4;

    const popup = drawPopup(cr, screen, dock, dock.coverY, margin, box => {
        switch (settings.get_string('media-background')) {
        case 'color':
            setColor(cr, accent, 0.6);
            break;
        case 'blur': {
            const gradient = new cairo.LinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
            gradient.addColorStopRGBA(0, accent.red, accent.green, accent.blue, 0.75);
            gradient.addColorStopRGBA(1, accent.red, accent.green, accent.blue, 0.3);
            cr.setSource(gradient);
            break;
        }
        default:
            setColor(cr, fg, 0.15);
        }
        cr.fill();
    });
    drawPopupContent(cr, popup, fg);
}

/**
 * The dock's end, close up: the media cover, the tray button, "Show
 * Applications" and the clock with the battery, as the settings show them:
 * on pills of the same width or plain, the grid on a pill, big or as three
 * dots, the battery green while charging
 */
export function drawDockEnd(cr, width, height, colors, settings) {
    const {accent} = colors;
    const pills = settings.get_boolean('clock-pill');
    const style = settings.get_string('show-apps-style');
    const clock = settings.get_boolean('compact-panel');
    const battery = clock && settings.get_boolean('compact-battery');
    const s = 0.78; // of the real size in px
    const pillW = 54 * s;
    const items = [['cover', 54 * s], ['tray', 28 * s],
        ['apps', style === 'grid' ? 36 * s : 28 * s]];
    if (clock)
        items.push(['clock', (battery ? 39 : 28) * s]);
    const gap = 6 * s;
    const total = items.reduce((sum, [, h]) => sum + h, 0) + gap * (items.length - 1);

    // The dock: a dark strip, its rounded end at the bottom
    const dock = {w: 66 * s, h: Math.min(height - 8, total + 24)};
    dock.x = Math.round((width - dock.w) / 2);
    dock.y = height - dock.h - 4;
    roundedRect(cr, dock.x, dock.y - 20, dock.w, dock.h + 20, 14);
    cr.setSourceRGBA(0.1, 0.08, 0.12, 0.92);
    cr.fill();

    const x = dock.x + (dock.w - pillW) / 2;
    const pill = (y, h) => {
        if (!pills)
            return;
        roundedRect(cr, x, y, pillW, h, Math.min(h / 2, 13 * s));
        cr.setSourceRGBA(1, 1, 1, 0.1);
        cr.fillPreserve();
        cr.setSourceRGBA(1, 1, 1, 0.2);
        cr.setLineWidth(1);
        cr.stroke();
    };
    const white = (alpha = 1) => cr.setSourceRGBA(1, 1, 1, alpha);
    const dots = (cx, cy, size, rows) => {
        const step = size / 3;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < 3; c++) {
                cr.rectangle(cx - size / 2 + c * step + step * 0.2,
                    cy + (r - (rows - 1) / 2) * step - step * 0.3, step * 0.6, step * 0.6);
            }
        }
        cr.fill();
    };

    let y = dock.y + dock.h - total - 6;
    for (const [kind, h] of items) {
        const cx = x + pillW / 2;
        const cy = y + h / 2;
        if (kind === 'cover') {
            const gradient = new cairo.LinearGradient(x, y, x + pillW, y + h);
            gradient.addColorStopRGBA(0, accent.red, accent.green, accent.blue, 1);
            gradient.addColorStopRGBA(1, 0.95, 0.55, 0.75, 1);
            roundedRect(cr, x, y, pillW, h, 8 * s);
            cr.setSource(gradient);
            cr.fill();
        } else if (kind === 'tray') {
            pill(y, h);
            white(0.85);
            cr.setLineWidth(1.5);
            cr.moveTo(cx - 2, cy - 4);
            cr.lineTo(cx + 2, cy);
            cr.lineTo(cx - 2, cy + 4);
            cr.stroke();
        } else if (kind === 'apps') {
            if (style !== 'grid')
                pill(y, h);
            white(0.95);
            if (style === 'thin')
                dots(cx, cy + 3, 14, 1);
            else
                dots(cx, cy, style === 'grid' ? 22 : 14, 3);
        } else {
            pill(y, h);
            white();
            cr.selectFontFace('Sans', cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD);
            cr.setFontSize(11);
            const time = '13:54';
            const extents = cr.textExtents(time);
            cr.moveTo(cx - extents.width / 2 - extents.xBearing, y + (battery ? 13 : h / 2 + 4));
            cr.showText(time);
            if (battery) {
                // Charging: green with 'battery-colors'
                if (settings.get_boolean('battery-colors'))
                    cr.setSourceRGBA(0.43, 0.89, 0.6, 1);
                const by = y + h - 9;
                roundedRect(cr, cx - 12, by - 3, 6, 9, 1.5);
                cr.fill();
                cr.setFontSize(8);
                cr.moveTo(cx - 3, by + 5);
                cr.showText('77 %');
            }
        }
        y += h + gap;
    }
}

// The shell's font settings, which the font illustration shows
let interfaceSettings = null;

/**
 * Text on glass, close up: with subpixel smoothing ('rgba') the letters
 * get orange and blue fringes on the translucent glass, with grayscale
 * smoothing they stay clean
 */
export function drawFontSmoothing(cr, width, height) {
    interfaceSettings ??= new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
    const subpixel = interfaceSettings.get_string('font-antialiasing') === 'rgba';

    // A glass pill over a colorful wallpaper
    const gradient = new cairo.LinearGradient(0, 0, width, height);
    gradient.addColorStopRGBA(0, 0.35, 0.12, 0.4, 1);
    gradient.addColorStopRGBA(1, 0.12, 0.08, 0.2, 1);
    cr.rectangle(0, 0, width, height);
    cr.setSource(gradient);
    cr.fill();
    const w = 170, h = 80;
    const x = (width - w) / 2, y = (height - h) / 2;
    roundedRect(cr, x, y, w, h, 24);
    cr.setSourceRGBA(1, 1, 1, 0.1);
    cr.fillPreserve();
    cr.setSourceRGBA(1, 1, 1, 0.25);
    cr.setLineWidth(1.5);
    cr.stroke();

    cr.selectFontFace('Sans', cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD);
    cr.setFontSize(44);
    const text = '09:57';
    const extents = cr.textExtents(text);
    const tx = (width - extents.width) / 2 - extents.xBearing;
    const ty = (height + extents.height) / 2;
    // Fringes as subpixel smoothing makes them, a bit exaggerated
    if (subpixel) {
        for (const [dx, r, g, b] of [[-1.6, 1, 0.55, 0.15], [1.6, 0.25, 0.6, 1]]) {
            cr.setSourceRGBA(r, g, b, 0.85);
            cr.moveTo(tx + dx, ty);
            cr.showText(text);
        }
    }
    cr.setSourceRGBA(1, 1, 1, 1);
    cr.moveTo(tx, ty);
    cr.showText(text);
}

/** Compact bar: no top bar, clock below "Show Applications" with tooltip */
export function drawCompactPanel(cr, width, height, colors, settings) {
    const {accent, fg} = colors;
    const compact = settings.get_boolean('compact-panel');
    const screen = drawScreen(cr, width, height, colors, {topBar: !compact});
    const dock = drawDock(cr, screen, colors);
    if (!compact)
        return;

    const clockY = dock.showAppsY + 12;
    if (settings.get_boolean('clock-pill')) {
        setColor(cr, fg, 0.16);
        roundedRect(cr, dock.x + 0.5, clockY - 2, dock.w - 1, 9, 4);
        cr.fill();
    }
    setColor(cr, accent);
    cr.selectFontFace('Sans', cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD);
    cr.setFontSize(6);
    cr.moveTo(dock.x + 0.5, clockY + 4);
    cr.showText('11:40');

    // Tooltip: date, battery, notifications
    const tip = {x: dock.x + dock.w + 6, y: clockY - 18, w: 62, h: 26};
    roundedRect(cr, tip.x, tip.y, tip.w, tip.h, 4);
    setColor(cr, fg, 0.15);
    cr.fill();
    setColor(cr, fg, 0.6);
    for (const [i, length] of [0.8, 0.55, 0.7].entries()) {
        cr.rectangle(tip.x + 5, tip.y + 5 + i * 6, (tip.w - 10) * length, 3);
        cr.fill();
    }
}

/** Liquid glass: dock and popup let the wallpaper shine through */
export function drawGlass(cr, width, height, colors, settings) {
    const {accent} = colors;
    const glass = settings.get_boolean('glass-style');
    const clear = settings.get_string('glass-mode') === 'clear';
    const screen = drawScreen(cr, width, height, colors);

    // Wallpaper blobs, visible through the glass
    cr.save();
    cr.rectangle(screen.x, screen.top, screen.w, screen.y + screen.h - screen.top);
    cr.clip();
    setColor(cr, accent, glass && clear ? 0.7 : 0.45);
    cr.arc(screen.x + 20, screen.y + screen.h * 0.75, 34, 0, 2 * Math.PI);
    cr.fill();
    cr.arc(screen.x + screen.w * 0.45, screen.y + screen.h * 0.35, 26, 0, 2 * Math.PI);
    cr.fill();
    cr.restore();

    const paint = box => {
        if (glass) {
            glassPaint(cr, colors, box, clear);
        } else {
            setColor(cr, {red: 0.17, green: 0.17, blue: 0.18, alpha: 1});
            cr.fill();
        }
    };
    const dock = drawDock(cr, screen, colors, {cover: true, paint});
    const popup = drawPopup(cr, screen, dock, dock.coverY, 6, paint);
    drawPopupContent(cr, popup, colors.fg);
}

// A color between a and b; share 0 is a, 1 is b
function mixColor(a, b, share) {
    const channel = name => a[name] + (b[name] - a[name]) * share;
    return {red: channel('red'), green: channel('green'), blue: channel('blue'), alpha: 1};
}

// Pointer arrow with its tip at (x, y)
function drawPointer(cr, x, y, fg) {
    cr.moveTo(x, y);
    cr.lineTo(x, y + 11);
    cr.lineTo(x + 3, y + 8);
    cr.lineTo(x + 7, y + 8);
    cr.closePath();
    setColor(cr, fg);
    cr.fillPreserve();
    setColor(cr, {red: 0, green: 0, blue: 0, alpha: 1}, 0.6);
    cr.setLineWidth(0.8);
    cr.stroke();
}

// A colorful wallpaper over the screen below the top bar
function drawWallpaper(cr, screen, from, to) {
    const gradient = new cairo.LinearGradient(screen.x, screen.top, screen.x + screen.w, screen.y + screen.h);
    gradient.addColorStopRGBA(0, from.red, from.green, from.blue, 1);
    gradient.addColorStopRGBA(1, to.red, to.green, to.blue, 1);
    cr.rectangle(screen.x + 0.75, screen.top, screen.w - 1.5, screen.y + screen.h - screen.top - 0.75);
    cr.setSource(gradient);
    cr.fill();
}

// Sample cover color for the illustrations
const COVER_COLOR = {red: 0.93, green: 0.33, blue: 0.42, alpha: 1};
const WALLPAPER_FROM = {red: 0.85, green: 0.25, blue: 0.55, alpha: 1};
const WALLPAPER_TO = {red: 0.98, green: 0.6, blue: 0.25, alpha: 1};

/**
 * Progress: a ring around the cover in the dock, and the popup with its
 * progress bar (in the cover's color), the volume row and a cover fading
 * over to the next one
 */
export function drawProgress(cr, width, height, colors, settings) {
    const {accent, fg} = colors;
    const screen = drawScreen(cr, width, height, colors);
    const dock = drawDock(cr, screen, colors, {cover: true});

    // The cover in its own color, so the ring in the accent color stands out
    setColor(cr, COVER_COLOR);
    roundedRect(cr, dock.x + 3, dock.coverY, 10, 10, 2);
    cr.fill();
    if (settings.get_boolean('dock-progress-ring')) {
        const line = 0.6 + settings.get_int('dock-progress-ring-width') * 0.45;
        const [x, y, size] = [dock.x + 3 - line / 2, dock.coverY - line / 2, 10 + line];
        cr.setLineWidth(line);
        setColor(cr, {red: 0, green: 0, blue: 0, alpha: 1}, 0.45);
        roundedRect(cr, x, y, size, size, 2.5);
        cr.stroke();
        // The accent a bit lighter, as on the dark dock
        cr.setSourceRGBA(Math.min(1, accent.red * 1.3 + 0.15), Math.min(1, accent.green * 1.3 + 0.15),
            Math.min(1, accent.blue * 1.3 + 0.15), 1);
        cr.newSubPath();
        cr.moveTo(x + size / 2, y);
        cr.lineTo(x + size - 2.5, y);
        cr.arc(x + size - 2.5, y + 2.5, 2.5, -Math.PI / 2, 0);
        cr.lineTo(x + size, y + size - 2.5);
        cr.arc(x + size - 2.5, y + size - 2.5, 2.5, 0, Math.PI / 2);
        cr.lineTo(x + size / 2 - 2, y + size);
        cr.stroke();
    }

    const popup = drawPopup(cr, screen, dock, dock.coverY - 30, 6, () => {
        setColor(cr, fg, 0.15);
        cr.fill();
    });

    // Cover, fading over from the previous one
    if (settings.get_boolean('media-crossfade')) {
        setColor(cr, fg, 0.3);
        roundedRect(cr, popup.x + 9, popup.y + 4, 14, 14, 2);
        cr.fill();
    }
    setColor(cr, COVER_COLOR);
    roundedRect(cr, popup.x + 6, popup.y + 6, 14, 14, 2);
    cr.fill();
    setColor(cr, fg, 0.6);
    cr.rectangle(popup.x + 24, popup.y + 8, popup.w * 0.45, 3);
    cr.rectangle(popup.x + 24, popup.y + 14, popup.w * 0.3, 3);
    cr.fill();

    // Progress bar across the card, in the cover's color
    const bar = settings.get_boolean('media-progress-color') ? COVER_COLOR : fg;
    const barY = popup.y + 26;
    const barW = popup.w - 12;
    setColor(cr, fg, 0.25);
    roundedRect(cr, popup.x + 6, barY, barW, 2, 1);
    cr.fill();
    setColor(cr, bar);
    roundedRect(cr, popup.x + 6, barY, barW * 0.6, 2, 1);
    cr.fill();
    cr.arc(popup.x + 6 + barW * 0.6, barY + 1, 2.2, 0, 2 * Math.PI);
    cr.fill();

    // Controls
    setColor(cr, fg, 0.8);
    for (let i = -1; i <= 1; i++) {
        cr.arc(popup.x + popup.w / 2 + i * 10, barY + 11, i === 0 ? 3 : 2, 0, 2 * Math.PI);
        cr.fill();
    }

    // Volume and sound output
    if (settings.get_boolean('media-volume')) {
        const volumeY = barY + 21;
        setColor(cr, fg, 0.6);
        cr.arc(popup.x + 8, volumeY + 1, 1.8, 0, 2 * Math.PI);
        cr.fill();
        setColor(cr, fg, 0.25);
        roundedRect(cr, popup.x + 13, volumeY, barW - 16, 2, 1);
        cr.fill();
        setColor(cr, bar);
        roundedRect(cr, popup.x + 13, volumeY, (barW - 16) * 0.7, 2, 1);
        cr.fill();
        setColor(cr, fg, 0.6);
        cr.setLineWidth(1);
        cr.arc(popup.x + popup.w - 7, volumeY + 1, 2.5, 0, 2 * Math.PI);
        cr.stroke();
    }
}

/** Fish-eye zoom: icons grow towards the pointer, the closest the most */
export function drawFisheye(cr, width, height, colors, settings) {
    const {accent, fg} = colors;
    const screen = drawScreen(cr, width, height, colors);
    const on = settings.get_boolean('dock-magnify');
    const zoom = on ? settings.get_int('dock-magnify-zoom') / 100 : 1;
    const range = settings.get_int('dock-magnify-range');

    // The zoom exaggerated a bit, so it can be seen at this size
    const shown = 1 + (zoom - 1) * 1.6;
    const slot = 13;
    const count = Math.floor((screen.y + screen.h - screen.top - 12) / slot);
    const dock = {x: screen.x + 4, y: screen.top + 4, w: 16, h: count * slot + 4};
    roundedRect(cr, dock.x, dock.y, dock.w, dock.h, 4);
    setColor(cr, accent, 0.25);
    cr.fill();

    const hovered = Math.floor(count / 2);
    const pointerY = dock.y + 2 + hovered * slot + slot / 2 + 2;
    for (let i = 0; i < count; i++) {
        const center = dock.y + 2 + i * slot + slot / 2;
        const distance = Math.abs(pointerY - center) / slot;
        const reach = Math.max(0, 1 - distance / (range + 0.5));
        const size = 10 * (1 + (shown - 1) * reach * reach);
        setColor(cr, accent, i === hovered && on ? 1 : 0.7);
        roundedRect(cr, dock.x + 3, center - size / 2, size, size, 2 + size / 10);
        cr.fill();
    }
    drawPointer(cr, dock.x + 3 + 10 * shown - 2, pointerY - 2, fg);
}

/** Shine: the glass catches light at its top edge */
export function drawShine(cr, width, height, colors, settings) {
    const {fg} = colors;
    const screen = drawScreen(cr, width, height, colors);
    drawWallpaper(cr, screen, WALLPAPER_FROM, WALLPAPER_TO);
    const shine = settings.get_boolean('glass-style') ? settings.get_int('glass-shine') / 100 : 0;
    const clear = settings.get_string('glass-mode') === 'clear';

    const box = {x: screen.x + screen.w * 0.2, y: screen.top + 14, w: screen.w * 0.6, h: screen.h * 0.55};
    roundedRect(cr, box.x, box.y, box.w, box.h, 8);
    const gradient = new cairo.LinearGradient(0, box.y, 0, box.y + box.h);
    const base = clear ? 0.12 : 0.3;
    gradient.addColorStopRGBA(0, 0.1, 0.1, 0.12, base - 0.12 * shine);
    gradient.addColorStopRGBA(0.4, 0.1, 0.1, 0.12, base);
    gradient.addColorStopRGBA(1, 0.1, 0.1, 0.12, base + 0.1);
    cr.setSource(gradient);
    cr.fillPreserve();
    setColor(cr, {red: 1, green: 1, blue: 1, alpha: 1}, clear ? 0.45 : 0.3);
    cr.setLineWidth(1);
    cr.stroke();

    // The bright top edge, fading out to the corners
    if (shine > 0) {
        const edge = new cairo.LinearGradient(box.x, 0, box.x + box.w, 0);
        edge.addColorStopRGBA(0, 1, 1, 1, 0);
        edge.addColorStopRGBA(0.15, 1, 1, 1, shine);
        edge.addColorStopRGBA(0.85, 1, 1, 1, shine);
        edge.addColorStopRGBA(1, 1, 1, 1, 0);
        cr.setSource(edge);
        cr.setLineWidth(2);
        cr.moveTo(box.x + 6, box.y + 1.2);
        cr.lineTo(box.x + box.w - 6, box.y + 1.2);
        cr.stroke();
    }

    setColor(cr, fg, 0.85);
    cr.rectangle(box.x + 10, box.y + 12, box.w * 0.5, 3);
    cr.fill();
    setColor(cr, fg, 0.55);
    cr.rectangle(box.x + 10, box.y + 19, box.w * 0.35, 3);
    cr.fill();
}

/** Wallpaper tint: the glass takes on some of the wallpaper's color */
export function drawWallpaperTint(cr, width, height, colors, settings) {
    const {fg} = colors;
    const screen = drawScreen(cr, width, height, colors);
    drawWallpaper(cr, screen, WALLPAPER_FROM, WALLPAPER_TO);
    const on = settings.get_boolean('glass-style') && settings.get_boolean('glass-tint-wallpaper');
    // Exaggerated a bit, so a small share can still be seen
    const share = on ? Math.min(1, settings.get_int('glass-tint-strength') / 100 * 2) : 0;
    const neutral = {red: 0.12, green: 0.12, blue: 0.14, alpha: 1};
    const average = mixColor(WALLPAPER_FROM, WALLPAPER_TO, 0.5);

    const dock = drawDock(cr, screen, colors, {
        paint: () => {
            setColor(cr, mixColor(neutral, average, share), 0.85);
            cr.fill();
        },
    });
    const popup = drawPopup(cr, screen, dock, screen.top + 10, 6, () => {
        setColor(cr, mixColor(neutral, average, share), 0.8);
        cr.fillPreserve();
        setColor(cr, {red: 1, green: 1, blue: 1, alpha: 1}, 0.25);
        cr.setLineWidth(1);
        cr.stroke();
    });
    drawPopupContent(cr, popup, fg);
}

/** Overview: search field, results and an app folder as glass */
export function drawOverviewGlass(cr, width, height, colors, settings) {
    const {accent, fg} = colors;
    const screen = drawScreen(cr, width, height, colors, {topBar: false});
    drawWallpaper(cr, screen, mixColor(WALLPAPER_FROM, {red: 0, green: 0, blue: 0, alpha: 1}, 0.55),
        mixColor(WALLPAPER_TO, {red: 0, green: 0, blue: 0, alpha: 1}, 0.55));
    const glass = settings.get_boolean('glass-style') && settings.get_boolean('glass-overview');
    const paint = box => {
        if (glass) {
            glassPaint(cr, colors, box, settings.get_string('glass-mode') === 'clear');
        } else {
            setColor(cr, {red: 0.22, green: 0.22, blue: 0.22, alpha: 1});
            cr.fill();
        }
    };

    // Search field
    const entry = {x: screen.x + screen.w * 0.3, y: screen.y + 8, w: screen.w * 0.4, h: 10};
    roundedRect(cr, entry.x, entry.y, entry.w, entry.h, 5);
    paint(entry);
    setColor(cr, fg, 0.6);
    cr.arc(entry.x + 6, entry.y + 5, 2, 0, 2 * Math.PI);
    cr.fill();

    // Search results
    const results = {x: screen.x + screen.w * 0.12, y: entry.y + 18, w: screen.w * 0.42, h: screen.h * 0.55};
    roundedRect(cr, results.x, results.y, results.w, results.h, 6);
    paint(results);
    for (let i = 0; i < 3; i++) {
        setColor(cr, accent, 0.8);
        roundedRect(cr, results.x + 6, results.y + 6 + i * 13, 8, 8, 2);
        cr.fill();
        setColor(cr, fg, 0.6);
        cr.rectangle(results.x + 18, results.y + 8 + i * 13, results.w * 0.5, 3);
        cr.fill();
    }

    // An open app folder
    const folder = {x: screen.x + screen.w * 0.6, y: entry.y + 18, w: screen.w * 0.28, h: screen.h * 0.55};
    roundedRect(cr, folder.x, folder.y, folder.w, folder.h, 6);
    paint(folder);
    setColor(cr, accent, 0.8);
    for (let i = 0; i < 4; i++) {
        roundedRect(cr, folder.x + 8 + (i % 2) * 16, folder.y + 10 + Math.floor(i / 2) * 16, 10, 10, 2);
        cr.fill();
    }
}

/**
 * One panel: quick settings, notifications and calendar together, the
 * whole height of the screen next to the dock; otherwise the two separate
 * popups
 */
export function drawUnifiedPanel(cr, width, height, colors, settings) {
    const {accent, fg} = colors;
    const compact = settings.get_boolean('compact-panel');
    const screen = drawScreen(cr, width, height, colors, {topBar: !compact});
    const dock = drawDock(cr, screen, colors);
    const unified = settings.get_boolean('unified-panel');

    const toggles = (x, y, w) => {
        for (let i = 0; i < 6; i++) {
            setColor(cr, i % 3 === 0 ? accent : fg, i % 3 === 0 ? 0.9 : 0.3);
            roundedRect(cr, x + (i % 2) * (w / 2 + 1), y + Math.floor(i / 2) * 7, w / 2 - 1, 5, 2.5);
            cr.fill();
        }
    };
    const notifications = (x, y, w, count) => {
        for (let i = 0; i < count; i++) {
            setColor(cr, fg, 0.18);
            roundedRect(cr, x, y + i * 13, w, 11, 3);
            cr.fill();
            setColor(cr, fg, 0.55);
            cr.rectangle(x + 3, y + i * 13 + 3, w * 0.5, 2);
            cr.fill();
        }
    };
    const calendar = (x, y, w) => {
        setColor(cr, fg, 0.5);
        for (let i = 0; i < 21; i++) {
            cr.arc(x + 3 + (i % 7) * ((w - 6) / 6), y + 3 + Math.floor(i / 7) * 5, 0.9, 0, 2 * Math.PI);
            cr.fill();
        }
        setColor(cr, accent);
        cr.arc(x + 3 + 3 * ((w - 6) / 6), y + 8, 1.6, 0, 2 * Math.PI);
        cr.fill();
    };

    const x = dock.x + dock.w + 5;
    if (unified) {
        const panel = {x, y: screen.top + 4, w: screen.w * 0.36, h: screen.y + screen.h - screen.top - 8};
        roundedRect(cr, panel.x, panel.y, panel.w, panel.h, 5);
        glassPaint(cr, colors, panel);
        const inner = panel.w - 10;
        toggles(panel.x + 5, panel.y + 5, inner);
        notifications(panel.x + 5, panel.y + 30, inner, 3);
        setColor(cr, fg, 0.3);
        cr.rectangle(panel.x + 5, panel.y + panel.h - 22, inner, 0.8);
        cr.fill();
        calendar(panel.x + 5, panel.y + panel.h - 18, inner);
        return;
    }

    // Two popups at the clock: quick settings, and calendar with notifications
    const quick = {x, y: screen.y + screen.h - 30, w: screen.w * 0.3, h: 26};
    roundedRect(cr, quick.x, quick.y, quick.w, quick.h, 4);
    glassPaint(cr, colors, quick);
    toggles(quick.x + 4, quick.y + 4, quick.w - 8);
    const cal = {x: x + quick.w + 6, y: screen.y + screen.h - 44, w: screen.w * 0.44, h: 40};
    roundedRect(cr, cal.x, cal.y, cal.w, cal.h, 4);
    glassPaint(cr, colors, cal);
    notifications(cal.x + 4, cal.y + 4, cal.w * 0.55, 2);
    calendar(cal.x + cal.w * 0.62, cal.y + 6, cal.w * 0.34);
}

// The badge color the settings pick, as a Cairo color (0 to 1)
function badgeColor(settings, accent) {
    switch (settings.get_string('dock-badge-color-mode')) {
    case 'accent':
        return accent;
    case 'custom': {
        const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(settings.get_string('dock-badge-color'));
        if (match) {
            const [red, green, blue] = match.slice(1).map(part => parseInt(part, 16) / 255);
            return {red, green, blue, alpha: 1};
        }
        return accent;
    }
    default:
        return {red: 0.39, green: 0.8, blue: 0.41, alpha: 1}; // the theme's green
    }
}

/** Notification badges: an app icon in the dock with a count, a dot or none */
export function drawBadge(cr, width, height, colors, settings) {
    const {accent, fg} = colors;
    const style = settings.get_string('dock-badge-style');
    const color = badgeColor(settings, accent);

    // A piece of dock with three app icons, large enough to see the badge
    const size = 38;
    const dock = {x: width / 2 - 34, y: height / 2 - 76, w: 68, h: 152};
    roundedRect(cr, dock.x, dock.y, dock.w, dock.h, 16);
    setColor(cr, fg, 0.12);
    cr.fill();
    for (let i = 0; i < 3; i++) {
        setColor(cr, accent, i === 1 ? 0.95 : 0.45);
        roundedRect(cr, dock.x + (dock.w - size) / 2, dock.y + 9 + i * 46, size, size, 9);
        cr.fill();
    }

    const iconRight = dock.x + (dock.w + size) / 2;
    const iconTop = dock.y + 9 + 46;
    if (style === 'hidden')
        return;
    setColor(cr, color);
    if (style === 'dot') {
        cr.arc(iconRight - 2, iconTop + 4, 6, 0, 2 * Math.PI);
        cr.fill();
        return;
    }
    roundedRect(cr, iconRight - 14, iconTop - 4, 20, 16, 8);
    cr.fill();
    const light = 0.299 * color.red + 0.587 * color.green + 0.114 * color.blue > 0.6;
    cr.setSourceRGBA(light ? 0 : 1, light ? 0 : 1, light ? 0 : 1, 1);
    cr.selectFontFace('Sans', cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD);
    cr.setFontSize(11);
    cr.moveTo(iconRight - 7.5, iconTop + 8);
    cr.showText('3');
}

/**
 * New notifications: a banner at the top of the screen or at the bottom
 * next to the dock, where the setting puts it
 */
export function drawBannerPosition(cr, width, height, colors, settings) {
    const {accent, fg} = colors;
    const screen = drawScreen(cr, width, height, colors, {topBar: false});
    const dock = drawDock(cr, screen, colors);
    const left = dock.x + dock.w + 5;
    const right = screen.x + screen.w - 5;
    const w = (right - left) * 0.36;
    const position = settings.get_string('banner-position');
    const x = {center: (left + right - w) / 2, end: right - w}[position] ?? left;
    const y = position === 'bottom-start' ? screen.y + screen.h - 25 : screen.top + 5;
    roundedRect(cr, x, y, w, 20, 8);
    setColor(cr, fg, 0.22);
    cr.fill();
    setColor(cr, accent);
    cr.arc(x + 10, y + 10, 4, 0, 2 * Math.PI);
    cr.fill();
    setColor(cr, fg, 0.85);
    cr.rectangle(x + 19, y + 6, w * 0.4, 2.5);
    cr.fill();
    setColor(cr, fg, 0.45);
    cr.rectangle(x + 19, y + 12, w * 0.6, 2);
    cr.fill();
}

/**
 * Look: a quick settings popup next to the dock, its tiles and corners as
 * round and its titles as bold as the style makes them
 */
export function drawUiStyle(cr, width, height, colors, settings) {
    const {accent, fg} = colors;
    const oneUi = settings.get_string('ui-style') === 'oneui';
    const screen = drawScreen(cr, width, height, colors, {topBar: false});
    const dock = drawDock(cr, screen, colors);

    const panel = {x: dock.x + dock.w + 6, y: screen.top + 6, w: screen.w * 0.46, h: screen.y + screen.h - screen.top - 12};
    roundedRect(cr, panel.x, panel.y, panel.w, panel.h, oneUi ? 14 : 8);
    setColor(cr, fg, 0.13);
    cr.fill();

    // A slider, then two rows of round tiles; One UI puts each tile's
    // icon in a circle of its own
    const inner = panel.w - 12;
    const sliderH = oneUi ? 4 : 3;
    setColor(cr, fg, 0.2);
    roundedRect(cr, panel.x + 6, panel.y + 8, inner, sliderH, sliderH / 2);
    cr.fill();
    setColor(cr, accent);
    roundedRect(cr, panel.x + 6, panel.y + 8, inner * 0.6, sliderH, sliderH / 2);
    cr.fill();

    const tileH = 12;
    const tileW = (inner - 4) / 2;
    for (let i = 0; i < 6; i++) {
        const x = panel.x + 6 + (i % 2) * (tileW + 4);
        const y = panel.y + 18 + Math.floor(i / 2) * (tileH + 4);
        const on = i % 3 === 0;
        setColor(cr, on ? accent : fg, on ? 0.9 : 0.22);
        roundedRect(cr, x, y, tileW, tileH, tileH / 2);
        cr.fill();
        const iconX = x + tileH / 2;
        if (oneUi) {
            setColor(cr, on ? {red: 1, green: 1, blue: 1, alpha: 1} : fg, on ? 0.3 : 0.2);
            cr.arc(iconX, y + tileH / 2, tileH / 2 - 1.5, 0, 2 * Math.PI);
            cr.fill();
        }
        setColor(cr, fg, 0.85);
        cr.arc(iconX, y + tileH / 2, 1.6, 0, 2 * Math.PI);
        cr.fill();
        cr.rectangle(iconX + tileH / 2 + 1, y + tileH / 2 - 1, tileW * 0.42, 2);
        cr.fill();
    }

    // A card below, as round as the style's
    const cardY = panel.y + 18 + 3 * (tileH + 4) + 4;
    roundedRect(cr, panel.x + 6, cardY, inner, panel.y + panel.h - cardY - 6, oneUi ? 10 : 5);
    setColor(cr, fg, 0.1);
    cr.fill();
}

