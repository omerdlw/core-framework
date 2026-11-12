import type { TargetAndTransition, Transition } from "motion/react";

import { cssTransition, gpuTransform } from "@/foundation/utils";
import { useModuleMotion, useOptionalModuleMotion } from "@/react/theme";

import { DOCK_SURFACE_PHASE, dockTheme } from "./constants";
import type {
  DockMotion,
  DockSurfacePhaseKey,
  DockSurfacePhaseMotion,
  DockSurfaceTimings,
} from "./types";

function staggerDelay(
  index: number,
  { base, cap, exponent = 1 }: { base: number; cap: number; exponent?: number },
): number {
  return Math.min(cap, base * Math.pow(Math.max(0, index), exponent));
}

/** Returns the dock motion tokens (transitions, variants and deck settings) from the active theme. */
export function useDockMotion(): DockMotion {
  return useModuleMotion(dockTheme);
}

const IMMEDIATE_SURFACE_TIMINGS: DockSurfaceTimings = Object.freeze({
  anticipation: 0,
  collapseBody: 0,
  dismissAction: 0,
  expandBody: 0,
  restoreHeader: 0,
});

export function useDockSurfaceTimings(): DockSurfaceTimings {
  return (
    useOptionalModuleMotion(dockTheme)?.timings ?? IMMEDIATE_SURFACE_TIMINGS
  );
}

export const DOCK_COMPOSITOR_STYLE = Object.freeze({
  willChange: "transform, opacity",
  WebkitBackfaceVisibility: "hidden",
  WebkitFontSmoothing: "antialiased",
  backfaceVisibility: "hidden",
  transform: "translateZ(0)",
} as const);

export const DOCK_UNSEEN_EXIT = Object.freeze({
  opacity: 0,
  transition: Object.freeze({ duration: 0 }),
});

export const DOCK_SURFACE_DRAG_CONSTRAINTS = Object.freeze({
  top: 0,
  bottom: 0,
} as const);

export function toGpuTransform(
  y: unknown = 0,
  scale: unknown = 1,
  x: unknown = 0,
): string {
  return gpuTransform(y, scale, x);
}

export const dockSurfaceDragTransformTemplate = ({
  y,
  scale,
}: {
  y?: unknown;
  scale?: unknown;
}) => toGpuTransform(y, scale);

export function getDockBackdropTransition(
  motion: DockMotion,
  {
    expanded = false,
    isSurface = false,
  }: {
    expanded?: boolean;
    isSurface?: boolean;
  } = {},
) {
  return isSurface || expanded
    ? motion.transitions.expand
    : motion.transitions.stack;
}

export function getDockActionMotionProps(
  motion: DockMotion,
  {
    disabled = false,
    reduceMotion = false,
  }: {
    disabled?: boolean;
    reduceMotion?: boolean;
  } = {},
) {
  const canMove = !disabled && !reduceMotion;
  return {
    initial: false as const,
    animate: "idle",
    whileTap: canMove ? "tap" : undefined,
    variants: motion.variants.press,
    transition: motion.transitions.press,
  };
}

export function getDockMediaVolumeFillTransition(
  motion: DockMotion,
  { isDragging = false }: { isDragging?: boolean } = {},
) {
  return isDragging
    ? "none"
    : cssTransition("width", motion.transitions.mediaVolume);
}

export function getDockMediaVolumeThumbAnimateProps(
  motion: DockMotion,
  { isDragging = false }: { isDragging?: boolean } = {},
) {
  return isDragging
    ? motion.variants.mediaVolumeThumb.dragging
    : motion.variants.mediaVolumeThumb.idle;
}

export function getDockMediaVolumeThumbPositionTransition(
  motion: DockMotion,
  { isDragging = false }: { isDragging?: boolean } = {},
) {
  return isDragging
    ? "none"
    : cssTransition("left", motion.transitions.mediaVolume);
}

const SURFACE_PHASE_KEYS: Readonly<Record<string, DockSurfacePhaseKey>> =
  Object.freeze({
    [DOCK_SURFACE_PHASE.IDLE]: "idle",
    [DOCK_SURFACE_PHASE.DISMISSING_ACTION]: "dismissAction",
    [DOCK_SURFACE_PHASE.EXPANDING_BODY]: "expandBody",
    [DOCK_SURFACE_PHASE.OPEN]: "open",
    [DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION]: "anticipation",
    [DOCK_SURFACE_PHASE.COLLAPSING_BODY]: "collapseBody",
    [DOCK_SURFACE_PHASE.RESTORING_HEADER]: "restoreHeader",
  });

export function getDockPhaseMotion(
  motion: DockMotion,
  surfacePhase?: string | null,
): DockSurfacePhaseMotion {
  const key = (surfacePhase && SURFACE_PHASE_KEYS[surfacePhase]) || "idle";
  return motion.phases[key];
}

/** Variants for the header restoring after a surface closes, using the phase's own timing. */
export function getDockHeaderRestoreVariants(
  motion: DockMotion,
  surfacePhase?: string | null,
) {
  const { headerRestore } = motion.variants;
  const visible = headerRestore.visible as TargetAndTransition;
  return {
    hidden: headerRestore.hidden,
    visible: {
      ...visible,
      transition:
        getDockPhaseMotion(motion, surfacePhase).headerReturn ??
        visible.transition,
    },
    exit: headerRestore.exit,
  };
}

export function getDockStackTransformTransition(
  motion: DockMotion,
  surfacePhase: string | null | undefined,
  fallbackTransition: Transition,
) {
  return (
    getDockPhaseMotion(motion, surfacePhase).transform ?? fallbackTransition
  );
}

export function getDockStackTransition(
  motion: DockMotion,
  {
    expanded = false,
    resizeDistance = 0,
    surfacePhase = null,
  }: {
    expanded?: boolean;
    resizeDistance?: number;
    surfacePhase?: string | null;
  } = {},
) {
  const { deck } = getDockPhaseMotion(motion, surfacePhase);
  if (typeof deck === "function") {
    return deck(
      resizeDistance > 0 ? resizeDistance : motion.deck.resizeFallback,
    );
  }
  if (deck) return deck;
  return expanded ? motion.transitions.expand : motion.transitions.stack;
}

export function getDockLayoutTransition(motion: DockMotion) {
  return { layout: motion.transitions.layout };
}

export function getDockStackAnimateProps(
  motion: DockMotion,
  {
    width,
    height,
    isBreadcrumbsVisible = false,
    isFullscreen = false,
    isSurfaceActive = false,
    surfacePhase = null,
  }: {
    width: number | string | null | undefined;
    height: number | string | null | undefined;
    isBreadcrumbsVisible?: boolean;
    isExtensionsVisible?: boolean;
    isFullscreen?: boolean;
    isSurfaceActive?: boolean;
    surfacePhase?: string | null;
  },
) {
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  const liftAmount = isBreadcrumbsVisible ? motion.deck.breadcrumbOffset : 0;
  return {
    width: Math.max(0, Math.round(Number.isFinite(safeWidth) ? safeWidth : 0)),
    height: Math.max(
      0,
      Math.round(Number.isFinite(safeHeight) ? safeHeight : 0),
    ),
    transform: toGpuTransform(
      liftAmount,
      getDockPhaseMotion(motion, surfacePhase).scale,
    ),
    opacity: isFullscreen ? motion.deck.fullscreenOpacity : 1,
    boxShadow: isSurfaceActive
      ? motion.deck.elevation.elevated
      : motion.deck.elevation.rest,
    pointerEvents: isFullscreen ? ("none" as const) : ("auto" as const),
  };
}

export function getDockCardDelay(
  motion: DockMotion,
  {
    expanded = false,
    isStackHovered = false,
    position = 0,
  }: {
    expanded?: boolean;
    isStackHovered?: boolean;
    position?: number;
  } = {},
) {
  const { timings } = motion;
  const safePosition = Math.max(0, Number(position) || 0);
  if (expanded && safePosition > 0) {
    return staggerDelay(safePosition, {
      base: timings.expandStagger,
      cap: timings.expandStaggerCap,
      exponent: timings.staggerExponent,
    });
  }
  if (isStackHovered && safePosition > 0) {
    return staggerDelay(safePosition - 1, {
      base: timings.peekStagger,
      cap: timings.peekStaggerCap,
      exponent: timings.staggerExponent,
    });
  }
  return 0;
}

export interface DockItemMotionValues {
  opacity: number;
  scale: number;
  y: number;
}

export function getDockItemAnimateValues(
  motion: DockMotion,
  {
    motionValues,
    expanded = false,
    isStackHovered = false,
    isSurfaceActive = false,
    position = 0,
  }: {
    motionValues?: DockItemMotionValues;
    expanded?: boolean;
    isStackHovered?: boolean;
    isSurfaceActive?: boolean;
    position?: number;
  } = {},
) {
  if (!motionValues) return {};
  const safePosition = Math.max(0, Number(position) || 0);
  const isHoveredOffset =
    !expanded && isStackHovered && safePosition > 0 && !isSurfaceActive;
  const peek = isHoveredOffset ? motion.deck.peek(safePosition) : null;
  const y = peek ? motionValues.y - peek.lift : motionValues.y;
  const scale = peek ? motionValues.scale * peek.scale : motionValues.scale;

  return {
    transform: toGpuTransform(y, scale),
    opacity: motionValues.opacity,
  };
}

export function getDockItemTransition(
  motion: DockMotion,
  {
    expanded = false,
    isStackHovered = false,
    position = 0,
    delay = 0,
  }: {
    expanded?: boolean;
    isStackHovered?: boolean;
    position?: number;
    delay?: number;
  } = {},
): Transition {
  const safePosition = Math.max(0, Number(position) || 0);
  let baseTransition = motion.transitions.card;
  if (expanded) baseTransition = motion.transitions.cardExpanded;
  else if (isStackHovered && safePosition > 0) {
    baseTransition = motion.transitions.cardPeek;
  }
  return {
    ...baseTransition,
    delay: Number(delay) || 0,
  };
}

export function getDockItemExitValues(
  motion: DockMotion,
  {
    motionValues,
    position = 0,
  }: {
    motionValues?: DockItemMotionValues;
    position?: number;
  } = {},
) {
  const safePosition = Math.max(0, Number(position) || 0);
  return motion.deck.exit({
    position: safePosition,
    scale:
      motionValues && Number.isFinite(motionValues.scale)
        ? motionValues.scale
        : null,
    y:
      motionValues && Number.isFinite(motionValues.y)
        ? motionValues.y
        : safePosition * motion.deck.stacking.collapsed.offsetY,
  });
}

export function getDockCardContentAnimateProps(
  motion: DockMotion,
  {
    expanded = false,
    position = 0,
    isExtensionShelf = false,
  }: {
    expanded?: boolean;
    position?: number;
    isExtensionShelf?: boolean;
  } = {},
) {
  const isHidden = !expanded && position > 0 && !isExtensionShelf;
  return isHidden
    ? motion.variants.cardContent.hidden
    : motion.variants.cardContent.visible;
}
