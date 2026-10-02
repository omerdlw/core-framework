"use client";

import React, {
  useEffect,
  isValidElement,
  useCallback,
  useMemo,
  useState,
  useRef,
  type ReactNode,
  type SyntheticEvent,
  type ComponentType,
  type KeyboardEvent,
  type UIEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { isObject, toArray, clamp, cn } from "@/utils";
import { useGlobalEvent } from "@/hooks";
import { Icon } from "@/atoms";
import { useMotionValue, useSpring } from "motion/react";
import {
  isInlineActionPathMatch,
  isValidBannerUrl,
  resolveDockHeaderKey,
} from "./utils";
import {
  DockCardBannerProps,
  DockCardItemProps,
  type DockActionDescriptor,
  type DockItem,
  type DockBadgeState,
  type DockIconSource,
  type DockCardHeaderProps,
  type DockSlotContent,
  type StandardItemContentProps,
} from "./types";
import {
  DOCK_SURFACE_PHASE,
  DOCK_EVENTS,
  MAX_VISIBLE_STACKED_CARDS,
  PLAYBACK_RATES,
} from "./constants";
import { type DockCommandEntry } from "./runtime/commands";
import {
  shouldRenderInlineAction,
  getItemMeasurementKey,
  getRouteMeasurementKey,
  resolveDockVisualStyle,
  getDockItemCardProps,
  useDockTheme,
  useElementHeight,
} from "./hooks";
import { useDockHasMedia, useDockMedia, useDockMediaActions } from "./context";
import {
  DOCK_SURFACE_BODY_ENTER_TRANSITION,
  getDockCardDelay,
  dockHeaderRestoreVariants,
  DOCK_SCRUBBER_TOOLTIP_SPRING,
} from "./motion";
import { resolveDockRoutePolicy, useRoutePrefetch } from "./routing/navigation";

/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect -- imperative media-element control and ref forwarding sit outside React Compiler's model */

const bannerPreloadCache = new Set<string>();

function preloadBannerImage(url: string) {
  if (!isValidBannerUrl(url) || bannerPreloadCache.has(url)) return;
  if (typeof window === "undefined") return;
  bannerPreloadCache.add(url);
  const img = new Image();
  img.src = url;
  if (typeof img.decode === "function") {
    img.decode().catch(() => {});
  }
}

export function useDockCardBannerModel({
  banner,
  bannerUrl,
  bannerPosition,
  bannerSize,
  bannerRepeat,
  bannerOpacity,
  isActive = true,
  isSurfaceActive = false,
  isHudActive = false,
  isStatusActive = false,
  style,
  className,
}: DockCardBannerProps) {
  const bannerObj =
    typeof banner === "object" && banner !== null ? banner : null;
  const rawUrl =
    bannerObj?.url ||
    bannerObj?.bannerUrl ||
    (typeof banner === "string" ? banner : bannerUrl);
  const isValid = isValidBannerUrl(rawUrl);
  useEffect(() => {
    if (isValid && rawUrl) {
      preloadBannerImage(rawUrl);
    }
  }, [rawUrl, isValid]);

  return { bannerObj, rawUrl, isValid };
}

function normalizeToolbarActions(actions: unknown): DockCommandEntry[] {
  const arrayActions = toArray(actions);
  const normalized: DockCommandEntry[] = [];

  for (let i = 0; i < arrayActions.length; i++) {
    const action = arrayActions[i];
    if (isObject(action) && !isValidElement(action)) {
      const descriptor = action as DockActionDescriptor;
      normalized.push({ key: descriptor.key ?? `action-${i}`, ...descriptor });
    }
  }
  return normalized;
}

function getVisibleToolbarActions(
  actions: DockCommandEntry[],
): DockCommandEntry[] {
  return actions.filter((action) => action.visible !== false);
}

function sortToolbarActionsByOrder(
  actions: DockCommandEntry[],
): DockCommandEntry[] {
  return [...actions].sort(
    (left, right) => (right.order ?? 0) - (left.order ?? 0),
  );
}

function isActionlessDockItem(
  activeItem: DockItem | null | undefined,
): boolean {
  const isSurfaceActive = Boolean(
    activeItem?.isSurface &&
    activeItem?.surfacePhase !== DOCK_SURFACE_PHASE.RESTORING_HEADER,
  );
  return Boolean(
    activeItem?.isNotFound ||
    activeItem?.path === "not-found" ||
    activeItem?.isMasked ||
    isSurfaceActive,
  );
}

function isStatusToolbarActionAllowed(
  activeItem: DockItem | null | undefined,
): boolean {
  return (
    activeItem?.type === "APP_ERROR" ||
    activeItem?.type === "API_ERROR" ||
    activeItem?.type === "GUARD"
  );
}

function useDockCommands({
  activeItem,
  contextCommands = [],
}: {
  activeItem?: DockItem | null;
  contextCommands?: DockActionDescriptor[];
} = {}) {
  return useMemo(() => {
    if (isActionlessDockItem(activeItem)) return [];

    const extendedCommands = normalizeToolbarActions(activeItem?.actions);
    const dynamicContextCommands = normalizeToolbarActions(contextCommands);
    const mergedCommands = [...extendedCommands, ...dynamicContextCommands];

    if (activeItem?.isStatus && !isStatusToolbarActionAllowed(activeItem)) {
      return [];
    }

    return sortToolbarActionsByOrder(getVisibleToolbarActions(mergedCommands));
  }, [activeItem, contextCommands]);
}

export function useDockCommandBarModel({
  activeItem,
  contextCommands = [],
  hasBanner = false,
}: {
  activeItem?: DockItem | null;
  contextCommands?: DockActionDescriptor[];
  hasBanner?: boolean;
}) {
  const actions = useDockCommands({ activeItem, contextCommands });
  const pathname = usePathname();
  const currentPath =
    pathname ||
    activeItem?.path ||
    activeItem?.name ||
    activeItem?.id ||
    "root";
  const [isExiting, setIsExiting] = useState(false);
  const [prevActionsCount, setPrevActionsCount] = useState(actions.length);
  if (actions.length !== prevActionsCount) {
    if (actions.length === 0 && prevActionsCount > 0) {
      setIsExiting(true);
    }
    setPrevActionsCount(actions.length);
  }
  const handleExitComplete = useCallback(() => {
    if (actions.length === 0) setIsExiting(false);
  }, [actions.length]);

  return { actions, currentPath, isExiting, handleExitComplete };
}

export function useDockBadge(
  dockKey?: string | null,
  initialBadge?: ReactNode,
): DockBadgeState {
  const [badge, setBadge] = useState<DockBadgeState>({
    visible: Boolean(initialBadge),
    value: initialBadge as DockBadgeState["value"],
  });

  useGlobalEvent(
    dockKey ? DOCK_EVENTS.UPDATE_BADGE : null,
    (data?: {
      color?: string;
      key?: string;
      value?: string | number | null;
    }) => {
      if (data && data.key === dockKey) {
        setBadge({
          visible: data.value != null && data.value !== "",
          color: data.color,
          value: data.value,
        });
      }
    },
  );

  return badge;
}

export const stopAndPrevent = (event: SyntheticEvent) => {
  event.stopPropagation();
  event.preventDefault();
};

export const stopPropagationOnly = (event: SyntheticEvent) => {
  event.stopPropagation();
};

export function shouldShowMediaIcon({
  isActive,
  hasMedia,
  isStatus = false,
}: {
  isActive?: boolean;
  hasMedia?: boolean;
  isStatus?: boolean;
}): boolean {
  return Boolean(isActive && hasMedia && !isStatus);
}

export function useDockCardHeaderModel({
  item: propItem,
  link,
  activeItem = null,
  itemStyle,
  badge,
  showVideoIcon = false,
  isPlaying = false,
  effectiveIconOverlay = null,
  isIconInteractive = false,
  handleIconClick,
  description,
  isTop = false,
  contextCommands = [],
}: DockCardHeaderProps) {
  const item = (propItem ?? link)!;
  const bannerObject =
    typeof item.banner === "object" && item.banner !== null
      ? item.banner
      : null;
  const bannerUrl =
    bannerObject?.url ||
    bannerObject?.bannerUrl ||
    (typeof item.banner === "string" ? item.banner : item.bannerUrl);
  const hasBanner = isValidBannerUrl(bannerUrl);
  const headerKey = useMemo(
    () => resolveDockHeaderKey({ link: item, description, showVideoIcon }),
    [description, item, showVideoIcon],
  );

  return { item, hasBanner, headerKey };
}

export type DockActionSlot =
  { kind: "media" } | { kind: "action"; action: DockSlotContent } | null;

function isRenderableAction(action: DockSlotContent | undefined): boolean {
  return React.isValidElement(action) || typeof action === "function";
}

function ownsPathname(path: string | null | undefined, pathname: string) {
  return !path || isInlineActionPathMatch(path, pathname);
}

export function useActionSlot(
  item: DockItem,
  pathname: string,
  { isTop = false }: { isTop?: boolean } = {},
): DockActionSlot {
  const { action, isLoading, isOverlay, path, isStatus, isSurface } = item;
  const hasMedia = useDockHasMedia();

  return useMemo(() => {
    if (isLoading || (isOverlay && !isStatus) || isSurface) return null;
    if (isStatus) {
      return action && isRenderableAction(action)
        ? { kind: "action", action }
        : null;
    }
    if (isTop && hasMedia && ownsPathname(path, pathname)) {
      return { kind: "media" };
    }

    if (
      !shouldRenderInlineAction(
        { action, isLoading, isOverlay, path },
        pathname,
      )
    ) {
      return null;
    }
    return action && isRenderableAction(action)
      ? { kind: "action", action }
      : null;
  }, [
    action,
    isLoading,
    isOverlay,
    isStatus,
    isSurface,
    isTop,
    hasMedia,
    path,
    pathname,
  ]);
}

export function useStandardItemContentModel({
  item: propItem,
  link,
  activeItem = null,
  isTop = false,
  itemStyle,
  badge,
  isActive = false,
  footerNode,
  isHudActive = false,
  hud = null,
  clearHud = null,
  contextCommands = [],
  pathname,
}: StandardItemContentProps) {
  const item = (propItem ?? link)!;
  const { hasMedia, isPlaying } = useDockMedia();
  const { toggle: toggleMedia } = useDockMediaActions();
  const showVideoIcon = shouldShowMediaIcon({
    isActive,
    hasMedia,
    isStatus: item.isStatus,
  });
  const description = item.description;
  const effectiveIconOverlay = showVideoIcon ? null : item.iconOverlay;
  const isIconInteractive = Boolean(item.onClick || showVideoIcon);
  const handleIconClick = useCallback(
    (event: SyntheticEvent) => {
      if (showVideoIcon) {
        stopAndPrevent(event);
        toggleMedia();
        return;
      }
      if (item.onClick) {
        stopAndPrevent(event);
        item.onClick(event);
      }
    },
    [item, showVideoIcon, toggleMedia],
  );

  return {
    item,
    isPlaying,
    showVideoIcon,
    description,
    effectiveIconOverlay,
    isIconInteractive,
    handleIconClick,
  };
}

export function useDockCardItemModel({
  ref,
  activeItem = null,
  onContentHeightChange,
  isStackHovered,
  onMouseEnter,
  onMouseLeave,
  expanded,
  hasExtensions = false,
  position,
  onClick,
  isTop = false,
  item: propItem,
  link,
  isActive = false,
  statusStyle = null,
  isStatusActive = false,
  isHudActive = false,
  isSurfaceActive = false,
  hud = null,
  clearHud = null,
  contextCommands = [],
}: DockCardItemProps) {
  const item = (propItem ?? link)!;
  const [isHovered, setIsHovered] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { cancelRoutePrefetch, prefetchRoute } = useRoutePrefetch(router);
  const hasMedia = useDockHasMedia();
  const isTopHudActive = Boolean(isTop && isHudActive);
  const isCurrentActive = Boolean(
    !item.disabled && !item.isInactive && (expanded || isTop || isActive),
  );
  const isCurrentHud = Boolean(
    isHudActive || isTopHudActive || Boolean(hud) || Boolean(item.isHud),
  );
  const isCurrentStatus = Boolean(
    isStatusActive ||
    Boolean(item.isStatus) ||
    Boolean(statusStyle) ||
    Boolean(item.isNotFound),
  );
  const isCurrentSurface = Boolean(
    isSurfaceActive ||
    Boolean(item.isSurface) ||
    Boolean(
      activeItem?.isSurface &&
      activeItem?.surfacePhase !== DOCK_SURFACE_PHASE.RESTORING_HEADER,
    ),
  );
  const isHeaderRestoring =
    item.surfacePhase === DOCK_SURFACE_PHASE.RESTORING_HEADER;
  const showVideoScrubber = Boolean(
    isTop &&
    hasMedia &&
    ownsPathname(item.path, pathname) &&
    (!item.isSurface || isHeaderRestoring) &&
    !item.isStatus,
  );
  const badge = useDockBadge(item.name?.toLowerCase(), item.badge);
  const actionSlot = useActionSlot(item, pathname, { isTop });
  const cardContentRef = useRef<HTMLDivElement>(null);
  const showBorder = expanded ? isHovered : isHovered || isStackHovered;
  const effectiveStyle = useMemo(() => {
    if (!statusStyle) return item.style;
    if (!item.style) return statusStyle;
    return {
      ...statusStyle,
      ...item.style,
      card: { ...statusStyle.card, ...item.style.card },
      icon: { ...statusStyle.icon, ...item.style.icon },
      title: { ...statusStyle.title, ...item.style.title },
      description: { ...statusStyle.description, ...item.style.description },
    };
  }, [item.style, statusStyle]);
  const theme = useDockTheme();
  const isStatusCard = Boolean(item.isStatus || item.isNotFound || statusStyle);
  const itemStyle = useMemo(() => {
    const resolved = resolveDockVisualStyle(effectiveStyle, {
      isActive,
      isHovered: showBorder,
    });
    if (!isStatusCard) return resolved;
    const { slots } = theme;
    return {
      ...resolved,
      card: {
        ...resolved.card,
        className: cn(slots.statusCard, resolved.card.className),
      },
      icon: {
        ...resolved.icon,
        className: cn(slots.statusIcon, resolved.icon.className),
      },
      title: {
        ...resolved.title,
        className: cn(slots.statusTitle, resolved.title.className),
      },
      description: {
        ...resolved.description,
        className: cn(slots.statusDescription, resolved.description.className),
      },
    };
  }, [effectiveStyle, isActive, isStatusCard, showBorder, theme]);
  const renderedActionSlot =
    (item.isSurface && !isHeaderRestoring) || isTopHudActive
      ? null
      : actionSlot;
  const hasNestedInteractiveContent = Boolean(
    renderedActionSlot || (item.isSurface && !isHeaderRestoring),
  );
  const headerRestoreVariants = useMemo(
    () => ({
      hidden: dockHeaderRestoreVariants.hidden,
      visible: {
        ...dockHeaderRestoreVariants.visible,
        transition:
          item.surfacePhase === DOCK_SURFACE_PHASE.COLLAPSING_BODY
            ? DOCK_SURFACE_BODY_ENTER_TRANSITION
            : dockHeaderRestoreVariants.visible.transition,
      },
      exit: dockHeaderRestoreVariants.exit,
    }),
    [item.surfacePhase],
  );
  useElementHeight(
    onContentHeightChange,
    cardContentRef,
    isTop,
    getRouteMeasurementKey(
      pathname,
      getItemMeasurementKey({
        link: item,
        expanded: Boolean(expanded),
        isHovered,
        isStackHovered: Boolean(isStackHovered),
        isHud: isTopHudActive,
      }),
    ),
  );
  const handleMouseEnter = useCallback(() => {
    if (item.isOverlay) return;
    setIsHovered(true);
    if (
      resolveDockRoutePolicy({ href: item.path ?? "", item }).prefetch &&
      item.path
    )
      prefetchRoute(item.path);
    if (!expanded) onMouseEnter?.();
  }, [expanded, item, onMouseEnter, prefetchRoute]);
  const handleMouseLeave = useCallback(() => {
    if (item.isOverlay) return;
    if (item.path) cancelRoutePrefetch(item.path);
    setIsHovered(false);
    if (!expanded) onMouseLeave?.();
  }, [cancelRoutePrefetch, expanded, item, onMouseLeave]);
  const handleFocus = useCallback(() => {
    if (item.isOverlay) return;
    setIsHovered(true);
    const targetHref = item.targetPath || item.path;
    if (
      resolveDockRoutePolicy({ href: targetHref ?? "", item }).prefetch &&
      targetHref
    ) {
      prefetchRoute(targetHref, { immediate: true });
    }
    onMouseEnter?.();
  }, [item, onMouseEnter, prefetchRoute]);
  const handleBlur = useCallback(() => {
    if (item.isOverlay) return;
    setIsHovered(false);
    onMouseLeave?.();
  }, [item, onMouseLeave]);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onClick?.(event);
    },
    [onClick],
  );
  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (event.currentTarget.scrollTop !== 0) event.currentTarget.scrollTop = 0;
  }, []);
  const isExtensionShelf = Boolean(
    !expanded && position === 1 && hasExtensions,
  );
  const isCollapsedBackgroundCard = Boolean(
    !expanded && position > 0 && !isExtensionShelf,
  );
  const isCollapsedGhostCard = Boolean(
    !expanded && position >= MAX_VISIBLE_STACKED_CARDS && !isExtensionShelf,
  );
  const {
    className: cardClassName,
    data: cardData,
    style: cardStyle,
    motionValues,
  } = getDockItemCardProps({
    expanded,
    position,
    cardStyle: itemStyle.card,
    cardScale: itemStyle.scale,
    theme,
    isAnchoredToBottom: item.isSurface,
    visibleCount:
      item.isStatus && !isStackHovered ? 1 : hasExtensions && !expanded ? 2 : 3,
    hasExtensions,
  });
  const cardDelay = useMemo(
    () => getDockCardDelay({ expanded, isStackHovered, position }),
    [expanded, isStackHovered, position],
  );

  return {
    item,
    pathname,
    isTopHudActive,
    isCurrentActive,
    isCurrentHud,
    isCurrentStatus,
    isCurrentSurface,
    showVideoScrubber,
    badge,
    cardContentRef,
    itemStyle,
    renderedActionSlot,
    hasNestedInteractiveContent,
    headerRestoreVariants,
    handleMouseEnter,
    handleMouseLeave,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handleScroll,
    isExtensionShelf,
    isCollapsedBackgroundCard,
    isCollapsedGhostCard,
    cardClassName,
    cardData,
    cardStyle,
    motionValues,
    cardDelay,
  };
}

function resolveActionNode(
  action: DockSlotContent | undefined,
  mediaAction: ComponentType | null,
  showMediaAction: boolean,
  stackClass: string,
) {
  const MediaAction = mediaAction as ComponentType;

  if (React.isValidElement(action)) {
    return (
      <div className={stackClass}>
        {action}
        {showMediaAction && <MediaAction />}
      </div>
    );
  }
  if (typeof action === "function") {
    const ActionComponent = action as ComponentType;
    return (
      <div className={stackClass}>
        <ActionComponent />
        {showMediaAction && <MediaAction />}
      </div>
    );
  }
  return showMediaAction ? <MediaAction /> : null;
}

export function applyMediaAction(
  item: DockItem | null | undefined,
  hasMedia: boolean,
  toggleMedia: () => void,
  mediaAction: ComponentType | null,
  actionStackClass: string,
): DockItem | null {
  if (!item) return null;
  if (!hasMedia) return item;

  const showMediaAction = Boolean(mediaAction) && item.mediaAction !== false;
  return {
    ...item,
    action: resolveActionNode(
      item.action,
      mediaAction,
      showMediaAction,
      actionStackClass,
    ),
    onClick: (event?: SyntheticEvent) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      toggleMedia();
    },
  };
}

export function useDockMediaControlsModel({
  className = "",
}: {
  className?: string;
}) {
  const {
    audibleElement,
    element: videoElement,
    kind,
    loop: isLoop,
  } = useDockMedia();
  const { toggleLoop, setMuted: setVideoMuted } = useDockMediaActions();
  const [playbackRate, setPlaybackRate] = useState<number>(
    videoElement?.playbackRate || 1,
  );
  const [volume, setVolume] = useState<number>(() =>
    Number(audibleElement?.volume ?? 1),
  );
  const [isMuted, setIsMuted] = useState<boolean>(() =>
    Boolean(audibleElement?.muted),
  );
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const isDraggingRef = useRef(false);
  const volumeTrackRef = useRef<HTMLDivElement | null>(null);
  const volumeFillRef = useRef<HTMLDivElement | null>(null);
  const volumeThumbRef = useRef<HTMLDivElement | null>(null);
  const volumeDragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      volumeDragCleanupRef.current?.();
      volumeDragCleanupRef.current = null;
      isDraggingRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (
      typeof document !== "undefined" &&
      "pictureInPictureEnabled" in document
    ) {
      setIsPipSupported(Boolean(document.pictureInPictureEnabled));
    }
  }, []);
  useEffect(() => {
    if (!videoElement) {
      setPlaybackRate(1);
      setIsPipActive(false);
      return undefined;
    }

    const syncPlaybackRate = () => {
      const nextRate = Number(videoElement.playbackRate);
      setPlaybackRate(Number.isFinite(nextRate) && nextRate > 0 ? nextRate : 1);
    };
    const handleEnterPip = () => setIsPipActive(true);
    const handleLeavePip = () => setIsPipActive(false);

    syncPlaybackRate();

    videoElement.addEventListener("ratechange", syncPlaybackRate);
    videoElement.addEventListener("enterpictureinpicture", handleEnterPip);
    videoElement.addEventListener("leavepictureinpicture", handleLeavePip);

    return () => {
      videoElement.removeEventListener("ratechange", syncPlaybackRate);
      videoElement.removeEventListener("enterpictureinpicture", handleEnterPip);
      videoElement.removeEventListener("leavepictureinpicture", handleLeavePip);
    };
  }, [videoElement]);
  useEffect(() => {
    if (!audibleElement) {
      setVolume(1);
      setIsMuted(false);
      return undefined;
    }

    const syncVolumeState = () => {
      if (isDraggingRef.current) return;

      const currentVol = Number(audibleElement.volume) || 0;
      const currentMute = Boolean(audibleElement.muted);

      setVolume(currentVol);
      setIsMuted(currentMute);

      const effective = currentMute ? 0 : currentVol;
      const effectivePercent = `${effective * 100}%`;

      if (volumeFillRef.current)
        volumeFillRef.current.style.width = effectivePercent;
      if (volumeThumbRef.current)
        volumeThumbRef.current.style.left = effectivePercent;
    };

    syncVolumeState();

    audibleElement.addEventListener("volumechange", syncVolumeState);

    return () => {
      audibleElement.removeEventListener("volumechange", syncVolumeState);
    };
  }, [audibleElement]);
  const handleCycleSpeed = useCallback(() => {
    if (!videoElement) return;
    const currentIndex = (PLAYBACK_RATES as readonly number[]).indexOf(
      playbackRate,
    );
    const nextRate = PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
    videoElement.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  }, [playbackRate, videoElement]);
  const updateVolumeFromPosition = useCallback(
    (clientX: number) => {
      if (!audibleElement || !volumeTrackRef.current) return;

      const rect = volumeTrackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const offsetX = clamp(clientX - rect.left, 0, rect.width);
      const fraction = offsetX / rect.width;
      const nextVolume = Math.round(fraction * 100) / 100;
      const fractionPercent = `${fraction * 100}%`;

      if (volumeFillRef.current)
        volumeFillRef.current.style.width = fractionPercent;
      if (volumeThumbRef.current)
        volumeThumbRef.current.style.left = fractionPercent;

      audibleElement.volume = nextVolume;
      const nextMuted = nextVolume === 0;
      audibleElement.muted = nextMuted;

      setVideoMuted?.(nextMuted);
      setVolume(nextVolume);
      setIsMuted(nextMuted);
    },
    [setVideoMuted, audibleElement],
  );
  const handleVolumePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      volumeDragCleanupRef.current?.();
      isDraggingRef.current = true;
      setIsDraggingVolume(true);

      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {}

      updateVolumeFromPosition(event.clientX);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isDraggingRef.current) return;
        updateVolumeFromPosition(moveEvent.clientX);
      };

      const handlePointerUp = () => {
        isDraggingRef.current = false;
        setIsDraggingVolume(false);

        if (audibleElement) {
          setVolume(Number(audibleElement.volume) || 0);
          setIsMuted(Boolean(audibleElement.muted));
        }
        removePointerListeners();
      };

      const removePointerListeners = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        if (volumeDragCleanupRef.current === removePointerListeners) {
          volumeDragCleanupRef.current = null;
        }
      };

      window.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);

      volumeDragCleanupRef.current = removePointerListeners;
    },
    [updateVolumeFromPosition, audibleElement],
  );
  const handleToggleMute = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!audibleElement) return;

      if (isMuted || volume === 0) {
        const restoredVolume = volume === 0 ? 0.7 : volume;
        audibleElement.volume = restoredVolume;
        audibleElement.muted = false;

        setVideoMuted?.(false);
        setVolume(restoredVolume);
        setIsMuted(false);

        const restoredPercent = `${restoredVolume * 100}%`;
        if (volumeFillRef.current)
          volumeFillRef.current.style.width = restoredPercent;
        if (volumeThumbRef.current)
          volumeThumbRef.current.style.left = restoredPercent;
      } else {
        audibleElement.muted = true;
        setVideoMuted?.(true);
        setIsMuted(true);

        if (volumeFillRef.current) volumeFillRef.current.style.width = "0%";
        if (volumeThumbRef.current) volumeThumbRef.current.style.left = "0%";
      }
    },
    [isMuted, setVideoMuted, audibleElement, volume],
  );
  const handleTogglePip = useCallback(async () => {
    if (!videoElement) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await (videoElement as HTMLVideoElement).requestPictureInPicture();
      }
    } catch {}
  }, [videoElement]);
  const handleSkipBackward = useCallback(() => {
    if (!videoElement) return;
    const current = Number(videoElement.currentTime) || 0;
    videoElement.currentTime = Math.max(0, current - 10);
  }, [videoElement]);
  const handleSkipForward = useCallback(() => {
    if (!videoElement) return;
    const current = Number(videoElement.currentTime) || 0;
    const duration = Number(videoElement.duration) || 0;
    videoElement.currentTime =
      duration > 0 ? Math.min(duration, current + 10) : current + 10;
  }, [videoElement]);

  const handleVolumeKeyDown = (event: React.KeyboardEvent) => {
    if (!audibleElement) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.max(0, volume - 0.05);
      audibleElement.volume = next;
      const nextMuted = next === 0;
      audibleElement.muted = nextMuted;
      setVideoMuted?.(nextMuted);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(1, volume + 0.05);
      audibleElement.volume = next;
      audibleElement.muted = false;
      setVideoMuted?.(false);
    }
  };

  return {
    handleVolumeKeyDown,
    audibleElement,
    videoElement,
    toggleLoop,
    setVideoMuted,
    playbackRate,
    volume,
    isMuted,
    isDraggingVolume,
    isPipActive,
    isPipSupported: isPipSupported && kind === "video",
    volumeTrackRef,
    volumeFillRef,
    volumeThumbRef,
    isLoop,
    handleCycleSpeed,
    handleVolumePointerDown,
    handleToggleMute,
    handleTogglePip,
    handleSkipBackward,
    handleSkipForward,
  };
}

interface SeekEvent {
  clientX?: number;
  touches?: ArrayLike<{ clientX: number }>;
}

export function useDockMediaScrubberModel({
  className = "",
  showTimeOnHover = true,
}: {
  className?: string;
  showTimeOnHover?: boolean;
}) {
  const { hasMedia, isPlaying, element: videoElement } = useDockMedia();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const hoverX = useMotionValue(0);
  const smoothHoverX = useSpring(hoverX, DOCK_SCRUBBER_TOOLTIP_SPRING);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const rAFRef = useRef<number | null>(null);
  useEffect(() => {
    if (!videoElement) {
      if (progressBarRef.current)
        progressBarRef.current.style.transform = "scaleX(0)";
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const publishProgress = () => {
      const current = Math.max(0, Number(videoElement.currentTime) || 0);
      const total = Math.max(0, Number(videoElement.duration) || 0);
      const ratio = total > 0 ? clamp(current / total, 0, 1) : 0;

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${ratio})`;
      }

      setCurrentTime((prev) =>
        Math.abs(prev - current) >= 1 ? Math.floor(current) : prev,
      );
      setDuration((prev) => (prev === total ? prev : total));
    };

    const runProgressLoop = () => {
      publishProgress();
      rAFRef.current = requestAnimationFrame(runProgressLoop);
    };

    publishProgress();

    if (isPlaying) {
      rAFRef.current = requestAnimationFrame(runProgressLoop);
    } else if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
    }

    videoElement.addEventListener("timeupdate", publishProgress);
    videoElement.addEventListener("durationchange", publishProgress);
    videoElement.addEventListener("loadedmetadata", publishProgress);

    return () => {
      if (rAFRef.current !== null) cancelAnimationFrame(rAFRef.current);
      videoElement.removeEventListener("timeupdate", publishProgress);
      videoElement.removeEventListener("durationchange", publishProgress);
      videoElement.removeEventListener("loadedmetadata", publishProgress);
    };
  }, [isPlaying, videoElement]);
  const seekToTime = useCallback(
    (targetTime: number) => {
      if (!videoElement || duration <= 0) return;
      const nextTime = clamp(targetTime, 0, duration);
      videoElement.currentTime = nextTime;
      setCurrentTime(Math.floor(nextTime));

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${nextTime / duration})`;
      }
    },
    [duration, videoElement],
  );
  const handleSeek = useCallback(
    (event: SeekEvent) => {
      if (!videoElement || !scrubberRef.current || !duration) return;
      const rect = scrubberRef.current.getBoundingClientRect();
      const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
      const offsetX = clamp(clientX - rect.left, 0, rect.width);
      const percentage = rect.width > 0 ? offsetX / rect.width : 0;

      seekToTime(percentage * duration);
    },
    [duration, seekToTime, videoElement],
  );
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const keyTargets: Record<string, number> = {
        ArrowLeft: currentTime - 5,
        ArrowRight: currentTime + 5,
        Home: 0,
        End: duration,
      };
      if (!(event.key in keyTargets)) return;

      event.preventDefault();
      event.stopPropagation();
      seekToTime(keyTargets[event.key]);
    },
    [currentTime, duration, seekToTime],
  );
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!scrubberRef.current || !duration) return;
      const rect = scrubberRef.current.getBoundingClientRect();
      const clientX = event.clientX ?? 0;
      const offsetX = clamp(clientX - rect.left, 0, rect.width);
      const percentage = rect.width > 0 ? offsetX / rect.width : 0;

      hoverX.set(offsetX);
      setHoverTime(percentage * duration);
    },
    [duration, hoverX],
  );

  return {
    hasMedia,
    videoElement,
    currentTime,
    duration,
    isHovered,
    setIsHovered,
    hoverTime,
    smoothHoverX,
    scrubberRef,
    progressBarRef,
    handleSeek,
    handleKeyDown,
    handleMouseMove,
  };
}
