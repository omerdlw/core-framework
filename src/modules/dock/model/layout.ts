import {
  DOCK_CARD_LAYOUT,
  DOCK_SURFACE_PHASE,
  HEIGHT_EPSILON,
  VIEWPORT_MARGIN,
} from "../constants";
import type { ContainerHeightOptions, DockItem } from "../types";

const DEFAULT_CARD_WIDTH = 460;
const DESKTOP_MIN_VIEWPORT_WIDTH = 640;
const DESKTOP_VIEWPORT_GUTTER = 32;
const MOBILE_VIEWPORT_GUTTER = 16;
const DOCK_HEIGHT_CSS_VAR = "--dock-h";

/** Tallest height the dock may take, leaving a margin inside the viewport. */
export function getViewportMaxHeight(): number {
  if (typeof window === "undefined") return Infinity;
  return window.innerHeight - VIEWPORT_MARGIN;
}

/** Height of the dock container for a given card content height, clamped to the viewport. */
export function getContainerHeight({
  cardContentHeight,
  isHud = false,
}: ContainerHeightOptions): number {
  const chromeHeight = DOCK_CARD_LAYOUT.chromeHeight;
  const minCardHeight = isHud
    ? DOCK_CARD_LAYOUT.hudHeight
    : DOCK_CARD_LAYOUT.baseHeight;
  const numericContentHeight = Number(cardContentHeight);

  const nextCardHeight = Math.max(
    minCardHeight,
    (Number.isFinite(numericContentHeight) ? numericContentHeight : 0) +
      chromeHeight,
  );
  return Math.min(nextCardHeight, getViewportMaxHeight());
}

/** Card width for the current viewport, honouring an explicit width when given. */
export function getDockCardWidth({
  width,
}: {
  width?: number | string | null;
} = {}): number {
  if (typeof window === "undefined") {
    return width ? Number(width) || DEFAULT_CARD_WIDTH : DEFAULT_CARD_WIDTH;
  }

  const windowWidth = window.innerWidth;
  const isDesktop = windowWidth >= DESKTOP_MIN_VIEWPORT_WIDTH;
  const targetWidth = Number(width);

  if (Number.isFinite(targetWidth) && targetWidth > 0) {
    const gutter = isDesktop ? DESKTOP_VIEWPORT_GUTTER : MOBILE_VIEWPORT_GUTTER;
    return Math.min(targetWidth, Math.max(windowWidth - gutter, 0));
  }

  return Math.min(
    DEFAULT_CARD_WIDTH,
    Math.max(windowWidth - MOBILE_VIEWPORT_GUTTER, 0),
  );
}

/** Reads an element's border-box height from a resize entry, falling back to its offset height. */
export function getObservedHeight(
  entry: ResizeObserverEntry | undefined,
  element: HTMLElement | null,
): number {
  const rawBorderBoxSize = entry?.borderBoxSize as
    readonly ResizeObserverSize[] | ResizeObserverSize | undefined;
  const borderBoxSize = Array.isArray(rawBorderBoxSize)
    ? (rawBorderBoxSize as readonly ResizeObserverSize[])[0]
    : (rawBorderBoxSize as ResizeObserverSize | undefined);
  if (borderBoxSize?.blockSize != null) {
    return Math.round(borderBoxSize.blockSize);
  }
  if (entry?.contentRect?.height != null) {
    return Math.round(entry.contentRect.height);
  }
  return Math.round(element?.offsetHeight || 0);
}

/** True when two heights differ by more than the jitter tolerance. */
export function hasMeaningfulHeightChange(
  previousHeight: number,
  nextHeight: number,
): boolean {
  return (
    Math.abs(Math.round(nextHeight) - Math.round(previousHeight)) >
    HEIGHT_EPSILON
  );
}

/** Publishes the dock height as the `--dock-h` CSS variable. */
export function publishDockHeightCssVar(heightPx: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    DOCK_HEIGHT_CSS_VAR,
    `${Math.round(heightPx)}px`,
  );
}

function isSurfaceShapePhase(phase: string | undefined): boolean {
  return (
    phase === DOCK_SURFACE_PHASE.EXPANDING_BODY ||
    phase === DOCK_SURFACE_PHASE.OPEN ||
    phase === DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION
  );
}

/** Width the active item should animate toward, accounting for the surface phase. */
export function getTargetItemWidth(activeItem: DockItem | null) {
  if (!activeItem?.isSurface || isSurfaceShapePhase(activeItem.surfacePhase)) {
    return activeItem?.width;
  }
  return activeItem.restingWidth;
}

function resolveMeasurementState(link: DockItem, isHud: boolean): string {
  if (isHud) return "hud";
  if (link.isLoading) return "loading";
  if (link.isSurface) return `surface-${link.surfacePhase ?? "open"}`;
  return "standard";
}

/** Key that changes whenever an item's measured height should be re-read. */
export function getItemMeasurementKey({
  link,
  expanded,
  isHud = false,
}: {
  link: DockItem;
  expanded: boolean;
  isHud?: boolean;
  isHovered?: boolean;
  isStackHovered?: boolean;
}): string {
  const state = resolveMeasurementState(link, isHud);
  return `${link.path || link.name || "item"}:${state}:${expanded ? "expanded" : "collapsed"}`;
}

/** Measurement key scoped to a route. */
export function getRouteMeasurementKey(
  pathname: string | null,
  key: string,
): string {
  return `${pathname || ""}:${key}`;
}
