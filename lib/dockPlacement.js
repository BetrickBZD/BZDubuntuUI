import St from 'gi://St';

/**
 * Makes a popup's BoxPointer sit next to the visible dock instead of
 * wherever GNOME would put it: `margin` away from the dock and lined up with
 * `anchor` (same top edge in a side dock, same left edge in a top or bottom
 * dock; with `center` its middle level with the anchor's, for popups about
 * as small as it), kept on screen `margin` away from its edges.
 *
 * getOptions() returns {dock, anchor, margin, center} and is read on every
 * layout.
 * Returns a function that gives the BoxPointer its own placement back.
 */
export function placeNextToDock(boxPointer, getOptions) {
    boxPointer._reposition = function (box) {
        Object.getPrototypeOf(this)._reposition.call(this, box);
        reposition(this, box, getOptions());
    };
    return () => delete boxPointer._reposition;
}

function reposition(bp, box, {dock, anchor, margin, center = false}) {
    const work = bp._workArea;
    if (!work || !dock?.mapped || !anchor?.mapped)
        return;

    const dockBox = dock.get_transformed_extents();
    const anchorBox = anchor.get_transformed_extents();
    // Only the visible part counts: the box reserves -arrow-rise on its dock
    // side and may have an invisible CSS margin (top bar menus have one at
    // the bottom). Clamping to the work area keeps it on screen while the
    // dock slides out (intellihide).
    const rise = bp.getArrowHeight();
    const node = bp.get_theme_node();
    const [left, right, top, bottom] = [St.Side.LEFT, St.Side.RIGHT, St.Side.TOP, St.Side.BOTTOM]
        .map(side => node.get_margin(side));
    const [, , width, height] = bp.get_preferred_size();
    const alongY = y => Math.clamp(y,
        work.y + margin - top, work.y + work.height - margin - height + bottom);
    const alongX = x => Math.clamp(x,
        work.x + margin - left, work.x + work.width - margin - width + right);
    // Where the visible box starts along the dock: at the anchor's start or
    // with its middle at the anchor's
    const startY = center
        ? anchorBox.get_y() + (anchorBox.get_height() - (height - top - bottom)) / 2
        : anchorBox.get_y();
    const startX = center
        ? anchorBox.get_x() + (anchorBox.get_width() - (width - left - right)) / 2
        : anchorBox.get_x();

    let x, y;
    switch (bp._arrowSide) {
    case St.Side.LEFT:
        x = Math.max(dockBox.get_x() + dockBox.get_width(), work.x) + margin - rise - left;
        y = alongY(startY - top);
        break;
    case St.Side.RIGHT:
        x = Math.min(dockBox.get_x(), work.x + work.width) - margin - width + rise + right;
        y = alongY(startY - top);
        break;
    case St.Side.TOP:
        x = alongX(startX - left);
        y = Math.max(dockBox.get_y() + dockBox.get_height(), work.y) + margin - rise - top;
        break;
    case St.Side.BOTTOM:
        x = alongX(startX - left);
        y = Math.min(dockBox.get_y(), work.y + work.height) - margin - height + rise + bottom;
        break;
    default:
        return;
    }

    box.set_origin(Math.floor(x), Math.floor(y));
}
