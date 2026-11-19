import liquidGlass from './liquidGlass.js';

/**
 * All themes by id. A theme is a values file (shared values plus a palette
 * per shell style, see liquidGlass.js) with a stylesheet template next to
 * it; a new theme is one more pair, registered here.
 */
export const THEMES = {
    [liquidGlass.id]: liquidGlass,
};

/**
 * The theme with the values of one of its `modes` ('glass-mode') in place,
 * or as it is for a mode it doesn't have. It gets its own id, so its
 * stylesheet is cached apart.
 */
export function resolveTheme(id, mode) {
    const theme = THEMES[id];
    const overrides = theme.modes?.[mode];
    if (!overrides)
        return theme;
    return {
        ...theme,
        ...overrides,
        id: `${theme.id}-${mode}`,
        dark: {...theme.dark, ...overrides.dark},
        light: {...theme.light, ...overrides.light},
    };
}
