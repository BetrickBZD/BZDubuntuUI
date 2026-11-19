/**
 * Small color helpers shared by the media popup and the glass. Colors are
 * {red, green, blue} with 0-255 channels, plus `alpha` (0-1) where noted.
 */

// Average color of a (small) pixbuf
export function averageColor(pixbuf) {
    const pixels = pixbuf.get_pixels();
    const {width, height, rowstride} = pixbuf;
    const channels = pixbuf.n_channels;
    const sum = [0, 0, 0];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * rowstride + x * channels;
            for (let c = 0; c < 3; c++)
                sum[c] += pixels[i + c];
        }
    }
    const [red, green, blue] = sum.map(v => Math.round(v / (width * height)));
    return {red, green, blue};
}

// Perceived brightness of a color, 0 to 1
export function brightness({red, green, blue}) {
    return (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
}

// The color, darkened if needed to a brightness of at most max
export function darkened(color, max) {
    const scale = Math.min(1, max / Math.max(brightness(color), 0.01));
    const [red, green, blue] = [color.red, color.green, color.blue].map(c => Math.round(c * scale));
    return {red, green, blue};
}

// The color, lightened towards white if needed to a brightness of at least min
export function lightened(color, min) {
    const current = brightness(color);
    if (current >= min)
        return {red: color.red, green: color.green, blue: color.blue};
    const share = (min - current) / (1 - current);
    return mix(color, {red: 255, green: 255, blue: 255}, share);
}

// The same hue at full strength: scaled up until its strongest channel is
// at 255, so a dark cover still gives a lively color
export function vivid(color) {
    const scale = 255 / Math.max(color.red, color.green, color.blue, 1);
    const [red, green, blue] = [color.red, color.green, color.blue].map(c => Math.round(c * scale));
    return {red, green, blue};
}

// `share` (0 to 1) of b mixed into a; alpha is kept from a
export function mix(a, b, share) {
    const channel = name => Math.round(a[name] + (b[name] - a[name]) * share);
    const mixed = {red: channel('red'), green: channel('green'), blue: channel('blue')};
    if ('alpha' in a)
        mixed.alpha = a.alpha;
    return mixed;
}

// 'rgba(r, g, b, a)' or 'rgb(r, g, b)' as a color with alpha, or null
export function parseRgba(text) {
    const match = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(text.trim());
    if (!match)
        return null;
    const [red, green, blue] = match.slice(1, 4).map(Number);
    return {red, green, blue, alpha: match[4] === undefined ? 1 : Number(match[4])};
}

export function toCss({red, green, blue, alpha = 1}) {
    return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`;
}
