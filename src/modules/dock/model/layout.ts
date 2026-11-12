import {
  DOCK_CARD_LAYOUT,
  DOCK_SURFACE_PHASE,
  HEIGHT_EPSILON,
  VIEWPORT_MARGIN,
} from "../constants";
import type { ContainerHeightOptions, DockItem } from "../types";

export function getViewportMaxHeight(): number {
  if (typeof window === "undefined") return Infinity;
  return window.innerHeight - VIEWPORT_MARGIN;
}

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

export function getDockCardWidth({
  width,
}: {
  width?: number | string | null;
} = {}): number {
  if (typeof window === "undefined") return width ? Number(width) || 460 : 460;

  const windowWidth = window.innerWidth;
  const isDesktop = windowWidth >= 640;
  const targetWidth = Number(width);

  if (Number.isFinite(targetWidth) && targetWidth > 0) {
    return Math.min(
      targetWidth,
      Math.max(windowWidth - (isDesktop ? 32 : 16), 0),
    );
  }

  return Math.min(460, Math.max(windowWidth - 16, 0));
}

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

export function hasMeaningfulHeightChange(
  previousHeight: number,
  nextHeight: number,
): boolean {
  return (
    Math.abs(Math.round(nextHeight) - Math.round(previousHeight)) >
    HEIGHT_EPSILON
  );
}

export function publishDockHeightCssVar(heightPx: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--dock-h",
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

export function getTargetItemWidth(activeItem: DockItem | null) {
  if (!activeItem?.isSurface || isSurfaceShapePhase(activeItem.surfacePhase)) {
    return activeItem?.width;
  }
  return activeItem.restingWidth;
}

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
  const state = isHud
    ? "hud"
    : link.isLoading
      ? "loading"
      : link.isSurface
        ? `surface-${link.surfacePhase ?? "open"}`
        : "standard";
  return `${link.path || link.name || "item"}:${state}:${expanded ? "expanded" : "collapsed"}`;
}

export function getRouteMeasurementKey(
  pathname: string | null,
  key: string,
): string {
  return `${pathname || ""}:${key}`;
}
