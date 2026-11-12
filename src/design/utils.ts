import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { PillBox, ScrollState } from "./types";

export function initialsOf(name?: string): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const EDGE_TOLERANCE = 4;

export const DRAG_THRESHOLD = 5;

export const SCROLL_STEP = 0.8;

export const FRAME_SELECTOR = "[data-carousel-frame]";

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

export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const track = ref.current;
    if (!track) return;
    let startX = 0;
    let startLeft = 0;
    let pressed = false;
    let dragged = false;

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      pressed = true;
      dragged = false;
      startX = event.clientX;
      startLeft = track.scrollLeft;
    };
    const onMove = (event: PointerEvent) => {
      if (!pressed) return;
      const delta = event.clientX - startX;
      if (!dragged && Math.abs(delta) > DRAG_THRESHOLD) {
        dragged = true;
        track.dataset.dragging = "true";
      }
      if (dragged) track.scrollLeft = startLeft - delta;
    };
    const onUp = () => {
      pressed = false;
      delete track.dataset.dragging;
    };
    const onClickCapture = (event: MouseEvent) => {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    };

    track.addEventListener("pointerdown", onDown);
    track.addEventListener("click", onClickCapture, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [ref]);
}

let farSight: IntersectionObserver | null = null;

export function watchDistance(frame: HTMLElement) {
  if (typeof IntersectionObserver === "undefined") {
    frame.removeAttribute("data-far");
    return () => {};
  }
  farSight ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        entry.target.toggleAttribute("data-far", !entry.isIntersecting);
    },
    { rootMargin: "50% 25%" },
  );
  farSight.observe(frame);
  return () => farSight?.unobserve(frame);
}

export const INSTANT = { duration: 0 } as const;

export const HIGHLIGHT_STYLE = {
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
} as const;

export const PILL_STYLE = {
  left: 0,
  pointerEvents: "none",
  position: "absolute",
} as const;

export const PILL_BOX_STYLE = { ...PILL_STYLE, top: 0 } as const;

export function useSlidingPill<T extends HTMLElement>(
  selector: string,
  key: unknown,
  { wrapping = false }: { wrapping?: boolean } = {},
) {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<PillBox | null>(null);

  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const measure = () => {
      const chosen = list.querySelector<HTMLElement>(selector);
      if (!chosen) return;
      const next: PillBox = wrapping
        ? {
            height: chosen.offsetHeight,
            width: chosen.offsetWidth,
            x: chosen.offsetLeft,
            y: chosen.offsetTop,
          }
        : { width: chosen.offsetWidth, x: chosen.offsetLeft };
      setBox((prev) =>
        prev &&
        prev.x === next.x &&
        prev.y === next.y &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const child of list.children) observer.observe(child);
    return () => observer.disconnect();
  }, [key, selector, wrapping]);

  return { box, ref };
}

export const noSubscribe = () => () => {};

export const readHost = () => document.body;

export const noHost = () => null;

export const canAnchor = () =>
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("anchor-name", "--a");

export const cannotAnchor = () => false;
