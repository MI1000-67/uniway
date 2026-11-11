export type View = { x: number; y: number; w: number; h: number };

export type MapInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Read the actual space occupied by floating controls in the current layout. */
export function mapInsets(element: Element | null): MapInsets {
  const style = element ? getComputedStyle(element) : null;
  const read = (side: string) =>
    Number.parseFloat(style?.getPropertyValue(`--map-inset-${side}`) ?? "") ||
    24;
  return {
    left: read("left"),
    right: read("right"),
    top: read("top"),
    bottom: read("bottom"),
  };
}

/** Fit geographic content inside the visible space, not underneath panels. */
export function fitMapView(
  bounds: View,
  size: { width: number; height: number },
  inset: MapInsets,
): View {
  const width = Math.max(1, size.width),
    height = Math.max(1, size.height);
  const usableWidth = Math.max(80, width - inset.left - inset.right);
  const usableHeight = Math.max(80, height - inset.top - inset.bottom);
  const scale = Math.max(
    0.0001,
    Math.min(
      usableWidth / Math.max(1, bounds.w),
      usableHeight / Math.max(1, bounds.h),
    ),
  );
  return {
    x: bounds.x + bounds.w / 2 - (inset.left + usableWidth / 2) / scale,
    y: bounds.y + bounds.h / 2 - (inset.top + usableHeight / 2) / scale,
    w: Math.max(1, width / scale),
    h: Math.max(1, height / scale),
  };
}

export function zoomView(view: View, factor: number): View {
  // A fitted route can lie beyond manual zoom limits. Never reverse the
  // requested direction when returning from that fitted view.
  const minWidth = Math.min(80, view.w);
  const maxWidth = Math.max(6000, view.w);
  const w = Math.max(minWidth, Math.min(maxWidth, view.w * factor));
  const h = (w * view.h) / view.w;
  return {
    x: view.x + (view.w - w) / 2,
    y: view.y + (view.h - h) / 2,
    w,
    h,
  };
}
