"use client";

import {
  use,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useInsertionEffect,
  useState,
  type RefObject,
  type CSSProperties,
} from "react";
import { usePathname } from "next/navigation";
import { useStore, useIsomorphicLayoutEffect } from "@/hooks";
import { useModuleRegistration, type RegistryMetadata } from "@/kernel";
import { createStore, shallowEqual, cn } from "@/utils";
import { useModuleTheme } from "@/theme";
import { Z_INDEX } from "@/tokens";
import {
  DockContext,
  EMPTY_DOCK_STATE,
  useDockActions,
  useDockHeight,
  useDockSelector,
  useDockState,
  useOptionalDockActions,
  useOptionalDockState,
} from "./context";
import {
  isSamePath,
  blurActiveElement,
  focusDockElement,
  getDockFocusableElements,
  isEditableDockTarget,
  isInteractiveTarget,
  shouldRestoreDockFocus,
  isInlineActionPathMatch,
  getImageIconStyle,
  getItemKey,
  getItemMeasurementKey,
  getLineClampStyle,
  getRouteMeasurementKey,
  resolveDockActionClass,
  splitStyle,
  toObject,
} from "./utils";
import {
  type DockBannerInput,
  type DockPageConfig,
  type DockState,
  type DockReturnHandoff,
  type DockActions,
  type DockItem,
  type ContainerHeightOptions,
  type DockItemCardPropsOptions,
  type DockStyleSectionName,
  type DockVisualStyle,
  type DockVisualStyleInput,
  type DockVisualStyleSection,
  type DockVisualStyleSections,
  type UseDockHeightControllerOptions,
} from "./types";
import {
  DOCK_STYLE_SECTIONS,
  HEIGHT_EPSILON,
  DOCK_CARD_LAYOUT,
  DOCK_HEIGHT_BUFFER,
  DOCK_SURFACE_PHASE,
  VIEWPORT_MARGIN,
  dockTheme,
} from "./constants";

export {
  DockContext,
  useDockActions,
  useDockHeight,
  useDockSelector,
  useDockState,
  useOptionalDockActions,
  useOptionalDockState,
};

export function useDockTheme() {
  return useModuleTheme(dockTheme);
}

export function useDockActionClass() {
  const { slots } = useDockTheme();
  return useCallback(
    (options?: Parameters<typeof resolveDockActionClass>[1]) =>
      resolveDockActionClass(slots, options),
    [slots],
  );
}

export function useDockRegistration(
  config: DockPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean; [key: string]: unknown },
): void {
  useModuleRegistration("dock", config, options);
}

export function useDockBanner(
  banner: DockBannerInput | null | undefined,
  options?: {
    path?: string;
    position?: string;
    size?: string;
    opacity?: number;
    repeat?: string;
    [key: string]: unknown;
  },
): void {
  const position = options?.position;
  const size = options?.size;
  const opacity = options?.opacity;
  const repeat = options?.repeat;
  const targetPath = options?.path;

  const config = useMemo(() => {
    if (!banner) return null;
    if (typeof banner === "string") {
      return {
        bannerUrl: banner,
        ...(position ? { bannerPosition: position } : {}),
        ...(size ? { bannerSize: size } : {}),
        ...(opacity !== undefined ? { bannerOpacity: opacity } : {}),
        ...(repeat ? { bannerRepeat: repeat } : {}),
        ...(targetPath ? { path: targetPath } : {}),
      };
    }
    if (typeof banner === "object") {
      return {
        bannerUrl: banner.url || banner.bannerUrl,
        bannerPosition: banner.position || banner.bannerPosition || position,
        bannerSize: banner.size || banner.bannerSize || size,
        bannerOpacity: banner.opacity ?? banner.bannerOpacity ?? opacity,
        bannerRepeat: banner.repeat || banner.bannerRepeat || repeat,
        ...(targetPath ? { path: targetPath } : {}),
      };
    }
    return null;
  }, [banner, position, size, opacity, repeat, targetPath]);

  useDockRegistration(config, options);
}

const EMPTY_DOCK_STATE_STORE = createStore<DockState>(EMPTY_DOCK_STATE);

function selectDockConfigState(state: DockState) {
  return {
    activeItem: state.activeItem,
    dockHeight: state.dockHeight,
    expanded: state.expanded,
    pathname: state.pathname,
  };
}

export function useDockConfig(
  configOrTitle?: string | Record<string, unknown> | null,
  options?: Record<string, unknown>,
) {
  const normalizedConfig = useMemo(() => {
    if (!configOrTitle) return null;
    if (typeof configOrTitle === "string") return { title: configOrTitle };
    return configOrTitle;
  }, [configOrTitle]);

  useDockRegistration(normalizedConfig, options);

  const dockContext = use(DockContext);
  const actions = dockContext?.actions;
  const state = useStore(
    dockContext?.store ?? EMPTY_DOCK_STATE_STORE,
    selectDockConfigState,
    shallowEqual,
  );

  return useMemo(
    () => ({
      activeItem: state.activeItem,
      clearHud: actions?.clearHud ?? (() => {}),
      closeAllSurfaces: actions?.closeAllSurfaces ?? (() => {}),
      closeSurface: actions?.closeSurface ?? (() => {}),
      expanded: state.expanded,
      dockHeight: state.dockHeight,
      navigate: actions?.navigate ?? (async () => false),
      openSurface: actions?.openSurface ?? (() => undefined),
      pathname: state.pathname,
      setExpanded: actions?.setExpanded ?? (() => {}),
      setHud: actions?.setHud ?? (() => {}),
      setSearchQuery: actions?.setSearchQuery ?? (() => {}),
    }),
    [actions, state],
  );
}

export function useDockDimensions() {
  const { dockHeight } = useDockHeight();
  const activeItem = useDockSelector((state) => state.activeItem);
  return {
    height: dockHeight,
    width: activeItem?.width ?? null,
    isSurface: Boolean(activeItem?.isSurface),
  };
}

export function useSurfaceReturn() {
  const pathname = usePathname();
  const { continuity } = useDockActions();
  const dockReturnHandoffs: DockReturnHandoff[] = useDockSelector(
    (state) => state.dockReturnHandoffs,
  );

  const entries = useMemo(
    () =>
      (dockReturnHandoffs || []).filter((handoff) =>
        isSamePath(handoff.path, pathname),
      ),
    [dockReturnHandoffs, pathname],
  );
  const consume = useCallback(
    (handoffId: string | null = null) =>
      continuity.consumeReturn(pathname, handoffId),
    [continuity, pathname],
  );

  return useMemo(
    () => ({ consume, entries, peek: () => entries[0] || null }),
    [consume, entries],
  );
}

export { blurActiveElement, focusDockElement, shouldRestoreDockFocus };

export function useDockFocusTrap({
  containerRef,
  enabled = true,
  onDismiss = null,
}: {
  containerRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
  onDismiss?: (() => void) | null;
}) {
  const hasAutoFocusedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      hasAutoFocusedRef.current = false;
      return;
    }

    const container = containerRef?.current;
    if (!container) return;

    const focusFrameId = window.requestAnimationFrame(() => {
      if (hasAutoFocusedRef.current) return;
      hasAutoFocusedRef.current = true;

      const preferredTarget = container.querySelector("[data-dock-autofocus]");
      const target =
        preferredTarget instanceof HTMLElement
          ? preferredTarget
          : getDockFocusableElements(container)[0] || container;
      focusDockElement(target);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        typeof onDismiss === "function"
      ) {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getDockFocusableElements(container);
      if (focusableElements.length === 0) {
        event.preventDefault();
        focusDockElement(container);
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        focusDockElement(lastElement);
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        focusDockElement(firstElement);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || container.contains(target)) return;

      if (
        target instanceof Element &&
        target.closest('[role="dialog"][aria-modal="true"]')
      ) {
        return;
      }

      const firstElement = getDockFocusableElements(container)[0] || container;
      focusDockElement(firstElement);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      window.cancelAnimationFrame(focusFrameId);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [containerRef, enabled, onDismiss]);
}

export function useDockKeyboard({
  expanded,
  focusedIndex,
  isOverlayActive,
  navigate,
  dockItems,
  setExpanded,
  setFocusedIndex,
}: {
  expanded: boolean;
  focusedIndex: number;
  isOverlayActive: boolean;
  navigate: DockActions["navigate"];
  dockItems: DockItem[];
  setExpanded: (expanded: boolean) => void;
  setFocusedIndex: (update: number | ((current: number) => number)) => void;
}) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        isEditableDockTarget(event.target) ||
        isInteractiveTarget(event.target)
      )
        return;
      if (isOverlayActive || !expanded) return;

      const { key } = event;
      if (key === "Escape") {
        event.preventDefault();
        setExpanded(false);
        return;
      }
      if (key === "Enter" && focusedIndex !== -1) {
        event.preventDefault();
        const focusedItem = dockItems[focusedIndex];
        if (focusedItem?.path)
          navigate(focusedItem.path, { item: focusedItem });
        return;
      }

      if (dockItems.length === 0) return;

      if (key === "ArrowDown") {
        event.preventDefault();
        setFocusedIndex((current) =>
          current < dockItems.length - 1 ? current + 1 : 0,
        );
        return;
      }
      if (key === "ArrowUp") {
        event.preventDefault();
        setFocusedIndex((current) =>
          current > 0 ? current - 1 : dockItems.length - 1,
        );
      }
    },
    [
      expanded,
      focusedIndex,
      isOverlayActive,
      navigate,
      dockItems,
      setExpanded,
      setFocusedIndex,
    ],
  );

  useEffect(() => {
    if (!expanded) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded, handleKeyDown]);
}

export function useDockRouteReset(
  pathname: string | null,
  onRouteChange?: (path: string | null) => void,
) {
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    onRouteChange?.(pathname);
  }, [onRouteChange, pathname]);
}

export {
  getImageIconStyle,
  getItemKey,
  getItemMeasurementKey,
  getLineClampStyle,
  getRouteMeasurementKey,
  splitStyle,
};

export function getDockItemCardProps({
  cardScale,
  cardStyle,
  expanded,
  hasExtensions = false,
  isAnchoredToBottom,
  position,
  theme,
  visibleCount = 3,
}: DockItemCardPropsOptions) {
  const { offsetY: collapsedOffsetY, scale: collapsedScale } =
    DOCK_CARD_LAYOUT.collapsed;
  const { offsetY: expandedOffsetY } = DOCK_CARD_LAYOUT.expanded;

  const safeCardStyle = { ...cardStyle };
  delete safeCardStyle.scale;
  delete safeCardStyle.className;

  const isTop = position === 0;
  const isShelf = !expanded && position === 1 && hasExtensions;
  const isHeavyBlur = position < visibleCount || expanded || isShelf;
  const collapsedScaleValue = collapsedScale ** position;

  const y = expanded
    ? position * expandedOffsetY
    : isShelf
      ? DOCK_CARD_LAYOUT.extensionShelfY
      : position * collapsedOffsetY;
  const shelfScale = DOCK_CARD_LAYOUT.extensionShelfScale ?? 0.94;
  const scale = expanded
    ? cardScale || 1
    : isShelf
      ? shelfScale
      : collapsedScaleValue;

  const collapsedOpacity = Math.max(0.1, +(1 - position * 0.2).toFixed(2));
  const opacity =
    expanded || isShelf ? 1 : position < visibleCount ? collapsedOpacity : 0;

  return {
    className: cn(theme.slots.card, cardStyle?.className),
    data: {
      "data-anchored": isAnchoredToBottom,
      "data-blur": isHeavyBlur ? "heavy" : "light",
      "data-placement": isTop ? "top" : isAnchoredToBottom ? "bottom" : "float",
      "data-shelf": isShelf,
    },
    style: {
      ...theme.styles.card,
      ...safeCardStyle,
      willChange: "transform, opacity",
      transformOrigin: isAnchoredToBottom ? "bottom center" : "top center",
      zIndex: Z_INDEX.DOCK_CARD_STACK_BASE - position,
      WebkitPerspective: 1000,
      perspective: 1000,
      WebkitBackfaceVisibility: "hidden" as const,
      backfaceVisibility: "hidden" as const,
      WebkitFontSmoothing: "antialiased",
      transform: "translateZ(0)",
      ...(isTop ? { height: "100%" } : {}),
      pointerEvents: (expanded || position < visibleCount
        ? undefined
        : "none") as CSSProperties["pointerEvents"],
    },
    motionValues: { y, scale, opacity },
  };
}

function getViewportMaxHeight(): number {
  if (typeof window === "undefined") return Infinity;
  return window.innerHeight - VIEWPORT_MARGIN;
}

function getContainerHeight({
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

function getDockCardWidth({
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
    ReadonlyArray<ResizeObserverSize> | ResizeObserverSize | undefined;
  const borderBoxSize = Array.isArray(rawBorderBoxSize)
    ? rawBorderBoxSize[0]
    : (rawBorderBoxSize as ResizeObserverSize | undefined);
  if (borderBoxSize?.blockSize != null)
    return Math.round(borderBoxSize.blockSize);
  if (entry?.contentRect?.height != null)
    return Math.round(entry.contentRect.height);
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

function publishDockHeightCssVar(heightPx: number) {
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

  useInsertionEffect(() => {
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
  if (!activeItem?.isSurface || isSurfaceShapePhase(activeItem.surfacePhase))
    return activeItem?.width;
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

function pickCardSurfaceStyle(
  style?: DockVisualStyleInput | null,
): Pick<CSSProperties, "background" | "borderColor"> {
  const cardSurfaceStyle: Pick<CSSProperties, "background" | "borderColor"> =
    {};
  if (style?.background != null) cardSurfaceStyle.background = style.background;
  if (style?.borderColor != null)
    cardSurfaceStyle.borderColor = style.borderColor;
  return cardSurfaceStyle;
}

function toStyleSections(value: unknown): DockVisualStyleSections {
  return toObject(value) as DockVisualStyleSections;
}

function mergeStyleSection(
  baseStyle: DockVisualStyleSections,
  stateStyle: DockVisualStyleSections,
  hoverStyle: DockVisualStyleSections,
  section: DockStyleSectionName,
): DockVisualStyleSection {
  return {
    ...toObject(baseStyle?.[section]),
    ...toObject(stateStyle?.[section]),
    ...toObject(hoverStyle?.[section]),
  } as DockVisualStyleSection;
}

export function resolveDockVisualStyle(
  style?: DockVisualStyleInput | null,
  {
    isActive = false,
    isHovered = false,
  }: { isActive?: boolean; isHovered?: boolean } = {},
): DockVisualStyle {
  const baseStyle = toObject(style) as DockVisualStyleInput;
  const stateStyle = isActive
    ? toStyleSections(baseStyle.active)
    : toStyleSections(baseStyle.inactive);
  const hoverStyle = isHovered ? toStyleSections(baseStyle.hover) : {};

  const sections: DockVisualStyle = {
    card: {},
    icon: {},
    title: {},
    description: {},
  };

  for (const section of DOCK_STYLE_SECTIONS) {
    sections[section] = mergeStyleSection(
      baseStyle,
      stateStyle,
      hoverStyle,
      section,
    );
  }

  sections.card = { ...pickCardSurfaceStyle(baseStyle), ...sections.card };

  return {
    ...sections,
    scale:
      hoverStyle?.card?.scale ?? stateStyle?.card?.scale ?? baseStyle?.scale,
  };
}

export function shouldRenderInlineAction(
  {
    action,
    isLoading,
    isOverlay,
    path,
  }: {
    action?: unknown;
    isLoading?: boolean;
    isOverlay?: boolean;
    path?: string | null;
  },
  pathname: string,
): boolean {
  return (
    Boolean(action) &&
    !isLoading &&
    (isOverlay || !path || isInlineActionPathMatch(path, pathname))
  );
}

export function getIsItemActive(
  link: DockItem | null,
  activeItem: DockItem | null,
): boolean {
  if (!link || !activeItem) return false;
  if (link.path && activeItem.path && isSamePath(link.path, activeItem.path))
    return true;
  if (
    link.targetPath &&
    activeItem.targetPath &&
    isSamePath(link.targetPath, activeItem.targetPath)
  )
    return true;
  return Boolean(link.name && activeItem.name && link.name === activeItem.name);
}
