/**
 * Liquid Glass: frosted glass for the dock, every popup and GNOME's own apps.
 * Values shared by both shell styles first, then one palette per style
 * (dark, light). liquidGlass.css is the stylesheet template these values are
 * filled into, as @name@. The dock, the popups and the windows all get the
 * same blur, brightness and tint, so the glass looks alike everywhere.
 */
export default {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    stylesheet: 'liquidGlass.css',

    // Corners of the dock and the popups next to it, in px
    radius: 16,
    // How far what is behind the glass is blurred, in px: live behind open
    // popups and, by shrinking the wallpaper as much, in the static frosted
    // wallpaper behind the dock and windows
    blurRadius: 48,
    // The frosted wallpaper a bit more vivid
    saturation: 1.15,
    // Share of 'window-glass-opacity' a window's background keeps
    windowOpacity: 1,
    // Blur of the quick settings' toggles under one of their menus, in px
    overlayBlur: 16,

    dark: {
        surface: 'rgba(24, 24, 30, 0.6)',       // tint over the blur
        rim: 'rgba(255, 255, 255, 0.14)',
        // Lighter than the popups': the frosted wallpaper behind the dock is
        // already dimmed by blurBrightness, and the dock has no text to keep
        // readable but the clock
        dock: 'rgba(24, 24, 30, 0.22)',
        dockRim: 'rgba(255, 255, 255, 0.14)',
        fill: 'rgba(255, 255, 255, 0.07)',      // buttons and boxes inside
        fillHover: 'rgba(255, 255, 255, 0.14)',
        fillActive: 'rgba(255, 255, 255, 0.2)',
        // Menus laid over the quick settings (power, Wi-Fi …), over the
        // toggles blurred under them
        overlay: 'rgba(48, 48, 54, 0.62)',
        // The light caught at the top edge, at full 'glass-shine'
        shine: 'rgba(255, 255, 255, 0.45)',
        dockShine: 'rgba(255, 255, 255, 0.4)',
        mediaShade: 'rgba(0, 0, 0, 0.15)',      // over the music card's cover
        // Over what is behind an app window, below the app
        windowTint: 'rgba(10, 10, 14, 0.6)',
        // Notification cards: GNOME stacks a group's cards a few px apart,
        // so any see-through would show the text of the ones behind
        card: 'rgba(52, 52, 58, 1)',
        // GNOME keeps its on-screen displays, switchers, the screenshot
        // tool and the overview's search and folders dark in both styles,
        // with white text: their glass, and what is in it, stays dark too
        osd: 'rgba(24, 24, 30, 0.6)',
        osdFill: 'rgba(255, 255, 255, 0.07)',
        osdFillHover: 'rgba(255, 255, 255, 0.14)',
        osdFillActive: 'rgba(255, 255, 255, 0.2)',
        blurBrightness: 0.8,                    // a bit darker for white text
    },

    // The dock stays dark in the light Ubuntu theme, and so does its glass
    light: {
        surface: 'rgba(250, 250, 252, 0.66)',
        rim: 'rgba(0, 0, 0, 0.1)',
        dock: 'rgba(24, 24, 30, 0.3)',
        dockRim: 'rgba(255, 255, 255, 0.14)',
        fill: 'rgba(0, 0, 0, 0.05)',
        fillHover: 'rgba(0, 0, 0, 0.09)',
        fillActive: 'rgba(0, 0, 0, 0.14)',
        overlay: 'rgba(250, 250, 252, 0.7)',
        shine: 'rgba(255, 255, 255, 0.95)',
        dockShine: 'rgba(255, 255, 255, 0.4)',
        mediaShade: 'rgba(0, 0, 0, 0.42)',      // the card keeps white text
        windowTint: 'rgba(250, 250, 252, 0.6)',
        card: 'rgba(255, 255, 255, 1)',
        // Darker than in the dark style: the light style's blur is brighter
        osd: 'rgba(28, 28, 34, 0.58)',
        osdFill: 'rgba(255, 255, 255, 0.1)',
        osdFillHover: 'rgba(255, 255, 255, 0.17)',
        osdFillActive: 'rgba(255, 255, 255, 0.24)',
        blurBrightness: 1.0,
    },

    // Variants for 'glass-mode', replacing the values above they name.
    // Clear like macOS's clear Liquid Glass: less blur and a light tint, so
    // much more of what is behind shows through; the rim stays brighter to
    // mark the edge, and the blur a bit darker to keep text readable.
    modes: {
        clear: {
            blurRadius: 20,
            overlayBlur: 10,
            saturation: 1.3,
            windowOpacity: 0.75,
            dark: {
                surface: 'rgba(24, 24, 30, 0.26)',
                rim: 'rgba(255, 255, 255, 0.22)',
                dock: 'rgba(24, 24, 30, 0.08)',
                dockRim: 'rgba(255, 255, 255, 0.22)',
                fill: 'rgba(255, 255, 255, 0.1)',
                fillHover: 'rgba(255, 255, 255, 0.18)',
                fillActive: 'rgba(255, 255, 255, 0.25)',
                overlay: 'rgba(40, 40, 46, 0.42)',
                shine: 'rgba(255, 255, 255, 0.55)',
                dockShine: 'rgba(255, 255, 255, 0.5)',
                mediaShade: 'rgba(0, 0, 0, 0.25)',
                windowTint: 'rgba(10, 10, 14, 0.5)',
                card: 'rgba(48, 48, 54, 1)',
                osd: 'rgba(24, 24, 30, 0.3)',
                blurBrightness: 0.72,
            },
            light: {
                surface: 'rgba(250, 250, 252, 0.34)',
                rim: 'rgba(255, 255, 255, 0.45)',
                dock: 'rgba(24, 24, 30, 0.12)',
                dockRim: 'rgba(255, 255, 255, 0.22)',
                fill: 'rgba(0, 0, 0, 0.06)',
                fillHover: 'rgba(0, 0, 0, 0.11)',
                fillActive: 'rgba(0, 0, 0, 0.16)',
                overlay: 'rgba(250, 250, 252, 0.5)',
                shine: 'rgba(255, 255, 255, 1)',
                dockShine: 'rgba(255, 255, 255, 0.5)',
                mediaShade: 'rgba(0, 0, 0, 0.45)',
                windowTint: 'rgba(250, 250, 252, 0.5)',
                card: 'rgba(255, 255, 255, 1)',
                osd: 'rgba(28, 28, 34, 0.4)',
                blurBrightness: 0.95,
            },
        },
    },
};
