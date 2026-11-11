export const EDGE_TOLERANCE = 4;
export const DRAG_THRESHOLD = 5;
const SCROLL_STEP = 0.8;

export const FRAME_SELECTOR = "[data-carousel-frame]";

export interface ScrollState {
  left: boolean;
  right: boolean;
}

export function readScroll(track: HTMLElement): ScrollState {
  return {
    left: track.scrollLeft > EDGE_TOLERANCE,
    right:
      track.scrollLeft + track.clientWidth < track.scrollWidth - EDGE_TOLERANCE,
  };
}

export function glideTarget(track: HTMLElement, direction: -1 | 1): number {
  const max = track.scrollWidth - track.clientWidth;
  const wanted = track.scrollLeft + track.clientWidth * SCROLL_STEP * direction;
  const edges = Array.from(
    track.children,
    (child) => (child as HTMLElement).offsetLeft - track.offsetLeft,
  ).filter((edge) => edge <= max);
  if (edges.length === 0) return Math.min(max, Math.max(0, wanted));

  let target = edges.reduce((best, edge) =>
    Math.abs(edge - wanted) < Math.abs(best - wanted) ? edge : best,
  );
  if (direction === 1 && target <= track.scrollLeft + EDGE_TOLERANCE)
    target =
      edges.find((edge) => edge > track.scrollLeft + EDGE_TOLERANCE) ?? max;
  if (direction === -1 && target >= track.scrollLeft - EDGE_TOLERANCE)
    target =
      [...edges]
        .reverse()
        .find((edge) => edge < track.scrollLeft - EDGE_TOLERANCE) ?? 0;
  if (direction === 1 && max - target < track.clientWidth * 0.25) target = max;
  if (direction === -1 && target < track.clientWidth * 0.25) target = 0;
  return target;
}

export function rackClip(
  track: HTMLElement,
  selector = FRAME_SELECTOR,
): string | null {
  const frame = track.querySelector<HTMLElement>(selector);
  if (!frame) return null;
  const radius = Number.parseFloat(getComputedStyle(frame).borderTopLeftRadius);
  if (!(radius > 0)) return null;
  const width = track.offsetWidth;
  const height = track.offsetHeight;
  let offset = 0;
  for (
    let node: HTMLElement | null = frame;
    node && node !== track;
    node = node.offsetParent as HTMLElement | null
  )
    offset += node.offsetTop;
  const top = Math.max(0, offset);
  const bottom = Math.min(height, offset + frame.offsetHeight);
  const r = Math.min(radius, (bottom - top) / 2, width / 2);
  if (!(r > 0) || width === 0) return null;
  const arc = (x: number, y: number) => `A${r} ${r} 0 0 1 ${x} ${y}`;
  return `path("${[
    `M0 0H${width}V${top}L${width - r} ${top}`,
    arc(width, top + r),
    `V${bottom - r}`,
    arc(width - r, bottom),
    `L${width} ${bottom}V${height}H0V${bottom}L${r} ${bottom}`,
    arc(0, bottom - r),
    `V${top + r}`,
    arc(r, top),
    `L0 ${top}Z`,
  ].join("")}")`;
}
