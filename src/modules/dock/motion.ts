import { type Transition } from "motion/react";
import { cssTransition, gpuTransform, staggerDelay } from "@/tokens";
import { useModuleMotion, useOptionalModuleMotion } from "@/theme";
import {
  DOCK_CARD_DIMENSIONS,
  DOCK_SURFACE_PHASE,
  dockTheme,
} from "./constants";
import { type DockMotion, type DockSurfaceTimings } from "./types";

// The dock plays only what the app's dock theme gives it. What stays here is
// mechanics: which of the app's transitions a state uses, and the parts of a
// target that come from layout rather than from motion.

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

/**
 * The app's surface phase timings. A dock state provider can run without the
 * dock's theme (nothing is drawn then), and its phases advance immediately.
 */
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

// A layer leaving a card whose content is out of sight goes at once. Played,
// its exit would show through as the card's content comes into light.
export const DOCK_UNSEEN_EXIT = Object.freeze({
  opacity: 0,
  transition: Object.freeze({ duration: 0 }),
});

export const DOCK_SURFACE_DRAG_CONSTRAINTS = Object.freeze({
  top: 0,
  bottom: 0,
} as const);

export const DOCK_SURFACE_DRAG_THRESHOLDS = Object.freeze({
  DISMISS_OFFSET_Y: 65,
  DISMISS_VELOCITY_Y: 400,
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

function getDockSurfaceStackScale(
  motion: DockMotion,
  surfacePhase?: string | null,
): number {
  if (surfacePhase === DOCK_SURFACE_PHASE.DISMISSING_ACTION) {
    return motion.deck.compress.open;
  }
  if (surfacePhase === DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION) {
    return motion.deck.compress.close;
  }
  return 1;
}

export function getDockStackTransformTransition(
  motion: DockMotion,
  surfacePhase: string | null | undefined,
  fallbackTransition: Transition,
) {
  if (surfacePhase === DOCK_SURFACE_PHASE.EXPANDING_BODY) {
    return motion.transitions.surfaceArrival;
  }
  if (
    surfacePhase === DOCK_SURFACE_PHASE.DISMISSING_ACTION ||
    surfacePhase === DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION
  ) {
    return motion.transitions.anticipation;
  }
  return fallbackTransition;
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
  if (surfacePhase === DOCK_SURFACE_PHASE.EXPANDING_BODY) {
    return motion.transitions.expand;
  }
  if (
    surfacePhase === DOCK_SURFACE_PHASE.OPEN ||
    surfacePhase === DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION
  ) {
    return motion.transitions.surfaceResize(
      resizeDistance > 0 ? resizeDistance : 260,
    );
  }
  if (
    surfacePhase === DOCK_SURFACE_PHASE.COLLAPSING_BODY ||
    surfacePhase === DOCK_SURFACE_PHASE.RESTORING_HEADER
  ) {
    return motion.transitions.expand;
  }
  return expanded ? motion.transitions.expand : motion.transitions.stack;
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
  const liftAmount = isBreadcrumbsVisible ? -44 : 0;
  return {
    width: Math.max(0, Math.round(Number.isFinite(safeWidth) ? safeWidth : 0)),
    height: Math.max(
      0,
      Math.round(Number.isFinite(safeHeight) ? safeHeight : 0),
    ),
    transform: toGpuTransform(
      liftAmount,
      getDockSurfaceStackScale(motion, surfacePhase),
    ),
    opacity: isFullscreen ? 0 : 1,
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
    });
  }
  if (isStackHovered && safePosition > 0) {
    return staggerDelay(safePosition - 1, {
      base: timings.peekStagger,
      cap: timings.peekStaggerCap,
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
  const baseTransition = expanded
    ? motion.transitions.cardExpanded
    : isStackHovered && safePosition > 0
      ? motion.transitions.cardPeek
      : motion.transitions.card;
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
        : safePosition * DOCK_CARD_DIMENSIONS.collapsedY,
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
