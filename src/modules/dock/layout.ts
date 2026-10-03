"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useIsomorphicLayoutEffect } from "@/hooks";
import {
  DOCK_CARD_LAYOUT,
  DOCK_HEIGHT_BUFFER,
  DOCK_SURFACE_PHASE,
  HEIGHT_EPSILON,
  VIEWPORT_MARGIN,
} from "./constants";
import {
  type ContainerHeightOptions,
  type DockItem,
  type UseDockHeightControllerOptions,
} from "./types";

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

function getObservedHeight(
  entry: ResizeObserverEntry | undefined,
  element: HTMLElement | null,
): number {
  const rawBorderBoxSize = entry?.borderBoxSize as
    | ReadonlyArray<ResizeObserverSize>
    | ResizeObserverSize
    | undefined;
  const borderBoxSize = Array.isArray(rawBorderBoxSize)
    ? rawBorderBoxSize[0]
    : (rawBorderBoxSize as ResizeObserverSize | undefined);
  if (borderBoxSize?.blockSize != null) {
    return Math.round(borderBoxSize.blockSize);
  }
  if (entry?.contentRect?.height != null) {
    return Math.round(entry.contentRect.height);
  }
  return Math.round(element?.offsetHeight || 0);
}

function hasMeaningfulHeightChange(
  previousHeight: number,
  nextHeight: number,
): boolean {
  return (
    Math.abs(Math.round(nextHeight) - Math.round(previousHeight)) >
    HEIGHT_EPSILON
  );
}

export function useElementHeight(
  onHeightChange?: ((height: number) => void) | null,
  elementRef?: RefObject<HTMLElement | null>,
  shouldMeasure?: boolean,
  dependencyKey: unknown = null,
) {
  const lastHeightRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const callbackRef = useRef(onHeightChange);

  useIsomorphicLayoutEffect(() => {
    callbackRef.current = onHeightChange;
  }, [onHeightChange]);

  useIsomorphicLayoutEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastHeightRef.current = -1;

    if (!callbackRef.current) return;
    if (!shouldMeasure) {
      if (hasMeaningfulHeightChange(lastHeightRef.current, 0)) {
        lastHeightRef.current = 0;
        callbackRef.current(0);
      }
      return;
    }

    const element = elementRef?.current;
    if (!element) return;

    function publishHeight(nextHeight: number) {
      if (!hasMeaningfulHeightChange(lastHeightRef.current, nextHeight)) return;
      lastHeightRef.current = nextHeight;
      callbackRef.current?.(nextHeight);
    }

    let pendingHeight: number | null = null;
    function flushPendingHeight() {
      rafRef.current = null;
      if (pendingHeight == null) return;
      const heightToPublish = pendingHeight;
      pendingHeight = null;
      publishHeight(heightToPublish);
    }

    function scheduleMeasurement(nextHeight: number) {
      pendingHeight = nextHeight;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(flushPendingHeight);
    }

    publishHeight(element.offsetHeight || 0);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        scheduleMeasurement(getObservedHeight(entry, element));
      }
    });
    observer.observe(element);

    const handlePageShow = () => scheduleMeasurement(element.offsetHeight || 0);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") handlePageShow();
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [dependencyKey, elementRef, shouldMeasure]);
}

export function publishDockHeightCssVar(heightPx: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--dock-h",
    `${Math.round(heightPx)}px`,
  );
}

export function useDockHeightController({
  contentKey = null,
  isHud = false,
  setDockHeight,
  surfacePhase = DOCK_SURFACE_PHASE.IDLE,
}: UseDockHeightControllerOptions) {
  const [containerHeight, setContainerHeight] = useState<number>(
    isHud ? DOCK_CARD_LAYOUT.hudHeight : DOCK_CARD_LAYOUT.baseHeight,
  );

  const heightRef = useRef<{ content: number }>({ content: 0 });
  const rafRef = useRef<number | null>(null);
  const isHudRef = useRef(isHud);
  const surfacePhaseRef = useRef(surfacePhase);

  const lastAppliedContainerHeightRef = useRef<number>(
    isHud ? DOCK_CARD_LAYOUT.hudHeight : DOCK_CARD_LAYOUT.baseHeight,
  );
  const lastAppliedSpacerHeightRef = useRef<number>(
    (isHud ? DOCK_CARD_LAYOUT.hudHeight : DOCK_CARD_LAYOUT.baseHeight) +
      DOCK_HEIGHT_BUFFER,
  );

  useIsomorphicLayoutEffect(() => {
    isHudRef.current = isHud;
    surfacePhaseRef.current = surfacePhase;
  }, [isHud, surfacePhase]);

  const applyHeight = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const { content } = heightRef.current;
    const currentPhase = surfacePhaseRef.current;
    const isLockedToBaseHeight =
      currentPhase === DOCK_SURFACE_PHASE.DISMISSING_ACTION ||
      currentPhase === DOCK_SURFACE_PHASE.COLLAPSING_BODY ||
      currentPhase === DOCK_SURFACE_PHASE.RESTORING_HEADER;

    const computedContentHeight = isLockedToBaseHeight ? 0 : content;
    const height = getContainerHeight({
      cardContentHeight: computedContentHeight,
      isHud: isHudRef.current,
    });

    const totalSpacerHeight = height + DOCK_HEIGHT_BUFFER;

    if (Math.abs(height - lastAppliedContainerHeightRef.current) > 0.5) {
      lastAppliedContainerHeightRef.current = height;
      setContainerHeight(height);
    }
    if (
      Math.abs(totalSpacerHeight - lastAppliedSpacerHeightRef.current) > 0.5
    ) {
      lastAppliedSpacerHeightRef.current = totalSpacerHeight;
      publishDockHeightCssVar(totalSpacerHeight);
      setDockHeight(totalSpacerHeight);
    }
  }, [setDockHeight]);

  const handleContentHeightChange = useCallback(
    (height: number | string) => {
      const numericHeight = Number(height);
      heightRef.current.content = Number.isFinite(numericHeight)
        ? Math.max(0, numericHeight)
        : 0;
      applyHeight();
    },
    [applyHeight],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useIsomorphicLayoutEffect(() => applyHeight(), [applyHeight, contentKey]);
  useIsomorphicLayoutEffect(() => applyHeight(), [applyHeight, surfacePhase]);
  useIsomorphicLayoutEffect(() => applyHeight(), [applyHeight, isHud]);

  return { containerHeight, handleContentHeightChange };
}

function isSurfaceShapePhase(phase: string | undefined): boolean {
  return (
    phase === DOCK_SURFACE_PHASE.EXPANDING_BODY ||
    phase === DOCK_SURFACE_PHASE.OPEN ||
    phase === DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION
  );
}

function getTargetItemWidth(activeItem: DockItem | null) {
  if (!activeItem?.isSurface || isSurfaceShapePhase(activeItem.surfacePhase)) {
    return activeItem?.width;
  }
  return activeItem.restingWidth;
}

export function useDockViewport(activeItem: DockItem | null = null) {
  const targetWidth = getTargetItemWidth(activeItem);
  const [, setViewportRevision] = useState(0);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const stackWidth = getDockCardWidth({ width: targetWidth });

  useIsomorphicLayoutEffect(() => {
    if (typeof document !== "undefined") setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let resizeFrameId: number | null = null;

    const handleResize = () => {
      if (resizeFrameId !== null) return;
      resizeFrameId = window.requestAnimationFrame(() => {
        resizeFrameId = null;
        setViewportRevision((revision) => revision + 1);
      });
    };

    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeFrameId !== null) window.cancelAnimationFrame(resizeFrameId);
    };
  }, []);

  return { portalTarget, stackWidth };
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
