import {
  DURATION_TOKENS,
  EASING_CURVES,
  MOTION_TIERS,
  contentSwapTransitions,
  press,
  surfaceResizeTransition,
  overlaySurface,
  chip,
  contentSwap,
  gpuTransform,
  staggerDelay,
  staggerItem,
} from "@/tokens";
import { type TargetAndTransition, type Transition, type Variants } from "motion/react";
import { DOCK_CARD_DIMENSIONS, DOCK_SURFACE_PHASE } from "./constants";

export const DOCK_DURATIONS = Object.freeze({
  MICRO: DURATION_TOKENS.MICRO,
  FAST: DURATION_TOKENS.FAST,
  BASE: DURATION_TOKENS.BASE,
  ACTION_DISMISS: 0.32,
  EXPAND: DURATION_TOKENS.CINEMATIC,
  COLLAPSE: 0.52,
  HEADER: 0.32,
  MODERATE: DURATION_TOKENS.MODERATE,
  SLOW: DURATION_TOKENS.SLOW,
} as const);

const DOCK_GLIDE_EASE = EASING_CURVES.OUT_QUART;

const DOCK_REVEAL_EASE = EASING_CURVES.OUT_EXPO;

const DOCK_WEIGHT_EASE = EASING_CURVES.OUT_QUINT;

export const DOCK_EASINGS = Object.freeze({
  FLUID: DOCK_GLIDE_EASE,
  FLUID_RESIZE: DOCK_GLIDE_EASE,
  PROGRESSIVE_EXIT: EASING_CURVES.IN_CUBIC,
  CINEMATIC: DOCK_REVEAL_EASE,
  EMPHASIZED: DOCK_REVEAL_EASE,
  SOFT: DOCK_GLIDE_EASE,
  SURFACE_WEIGHT: DOCK_WEIGHT_EASE,
  EXIT: EASING_CURVES.IN_CUBIC,
  SURFACE_ARRIVAL: EASING_CURVES.OUT_BACK,
} as const);

export const DOCK_SURFACE_STACK_SCALE = Object.freeze({
  REST: 1,
  OPEN_ANTICIPATION_COMPRESS: 0.94,
  CLOSE_ANTICIPATION_COMPRESS: 0.96,
} as const);

export const dockHeaderSwapTransitions = contentSwapTransitions({
  duration: DOCK_DURATIONS.HEADER,
  exitDuration: DOCK_DURATIONS.FAST,
  enterEase: DOCK_EASINGS.FLUID,
  exitEase: DOCK_EASINGS.EXIT,
});

export const dockControlSwapTransitions = contentSwapTransitions({
  duration: DOCK_DURATIONS.BASE,
  exitDuration: DOCK_DURATIONS.FAST,
  enterEase: DOCK_EASINGS.FLUID,
  exitEase: DOCK_EASINGS.EXIT,
});

export const dockTextSwapTransitions = contentSwapTransitions({
  duration: DOCK_DURATIONS.BASE,
  exitDuration: DOCK_DURATIONS.FAST,
  enterEase: DOCK_EASINGS.EMPHASIZED,
  exitEase: DOCK_EASINGS.EXIT,
});

export const DOCK_TIERS = MOTION_TIERS;

export const DOCK_SPRINGS = Object.freeze({
  PRESS: Object.freeze({
    type: "spring" as const,
    stiffness: 420,
    damping: 34,
    mass: 0.35,
  }),
  BADGE: Object.freeze({
    type: "spring" as const,
    stiffness: 360,
    damping: 30,
    mass: 0.45,
  }),
  DECK: Object.freeze({
    type: "spring" as const,
    stiffness: 210,
    damping: 34,
    mass: 1.2,
  }),
  PEEK: Object.freeze({
    type: "spring" as const,
    stiffness: 280,
    damping: 32,
    mass: 0.6,
  }),
  SCRUBBER_TOOLTIP: Object.freeze({
    damping: 28,
    stiffness: 350,
  }),
} as const);

export const DOCK_STAGGER_TIMINGS = Object.freeze({
  EXPAND: 0.055,
  COLLAPSE: 0.02,
  PEEK: 0.016,
  STANDARD: 0.032,
  FAST: 0.02,
  CONTENT_REVEAL: 0.06,
} as const);

export const DOCK_SURFACE_CHOREOGRAPHY_TIMINGS = Object.freeze({
  SURFACE_ANTICIPATION_MS: 240,
  ANTICIPATION_LEAD_MS: 70,
  ACTION_DISMISS_MS: DOCK_DURATIONS.ACTION_DISMISS * 1000,
  ACTION_DISMISS_OVERLAP_MS: 220,
  BODY_ENTER_MS: DOCK_DURATIONS.EXPAND * 1000,
  BODY_ENTER_DELAY_MS: 100,
  BODY_EXIT_MS: 760,
  BODY_COLLAPSE_SETTLE_MS: 100,
  HEADER_RESTORE_MS: 360,
  RESTORE_SETTLE_MS: 0,
} as const);

const DOCK_SURFACE_HEADER_REVEAL_DELAY_MS = 80;

export const DOCK_SURFACE_HEADER_RESTORE_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration:
    (DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.HEADER_RESTORE_MS -
      DOCK_SURFACE_HEADER_REVEAL_DELAY_MS) /
    1000,
  delay: DOCK_SURFACE_HEADER_REVEAL_DELAY_MS / 1000,
  ease: DOCK_EASINGS.SOFT,
});

export const DOCK_TAP_SCALE = 0.97;

export const DOCK_SURFACE_DRAG_CONSTRAINTS = Object.freeze({
  top: 0,
  bottom: 0,
} as const);

export const DOCK_SURFACE_DRAG_ELASTIC = Object.freeze({
  top: 0.05,
  bottom: 0.5,
} as const);

export const DOCK_SURFACE_DRAG_THRESHOLDS = Object.freeze({
  DISMISS_OFFSET_Y: 65,
  DISMISS_VELOCITY_Y: 400,
} as const);

export const DOCK_SURFACE_DRAG_INTERPOLATION = Object.freeze({
  DRAG_RANGE: Object.freeze([0, 180] as const),
  OPACITY_RANGE: Object.freeze([1, 0.75] as const),
  SCALE_RANGE: Object.freeze([1, 0.96] as const),
} as const);

export const DOCK_STACK_ELEVATION = Object.freeze({
  REST: "0px 12px 32px 0px rgba(0,0,0,0.35), 0px 2px 8px 0px rgba(0,0,0,0.25)",
  ELEVATED:
    "0px 32px 80px 0px rgba(0,0,0,0.55), 0px 8px 24px 0px rgba(0,0,0,0.35)",
} as const);

export const DOCK_COMPOSITOR_STYLE = Object.freeze({
  willChange: "transform, opacity",
  WebkitBackfaceVisibility: "hidden",
  WebkitFontSmoothing: "antialiased",
  backfaceVisibility: "hidden",
  transform: "translateZ(0)",
} as const);

export const DOCK_STACK_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.COLLAPSE,
  ease: DOCK_EASINGS.SOFT,
});

export const DOCK_CARD_EXPAND_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.EXPAND,
  ease: DOCK_EASINGS.SURFACE_WEIGHT,
});

export const dockSurfaceBodyRole = overlaySurface({
  travel: 14,
  exitTravel: 14,
  enterScale: 0.985,
  exitScale: 0.985,
  duration:
    (DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.BODY_ENTER_MS -
      DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.BODY_ENTER_DELAY_MS) /
    1000,
  exitDuration:
    DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.SURFACE_ANTICIPATION_MS / 1000,
  enterEase: DOCK_EASINGS.SURFACE_WEIGHT,
  exitEase: DOCK_EASINGS.SURFACE_WEIGHT,
});

export const DOCK_SURFACE_BODY_ENTER_TRANSITION = Object.freeze({
  ...dockSurfaceBodyRole.visible.transition,
  delay: DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.BODY_ENTER_DELAY_MS / 1000,
});

export const DOCK_SURFACE_BODY_EXIT_TRANSITION =
  dockSurfaceBodyRole.exit.transition;

export const DOCK_SURFACE_ANTICIPATION_HIDE_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.SURFACE_ANTICIPATION_MS / 1000,
  ease: DOCK_EASINGS.SURFACE_WEIGHT,
});

const DOCK_SURFACE_STEP_RESIZE_BASE = 0.5;
const DOCK_SURFACE_STEP_RESIZE_MIN = 0.4;
const DOCK_SURFACE_STEP_RESIZE_MAX = DOCK_DURATIONS.EXPAND;

function createDockSurfaceResizeTransition(distancePx: number) {
  const resize = surfaceResizeTransition(distancePx, {
    base: DOCK_SURFACE_STEP_RESIZE_BASE,
    min: DOCK_SURFACE_STEP_RESIZE_MIN,
    max: DOCK_SURFACE_STEP_RESIZE_MAX,
    ease: DOCK_EASINGS.SURFACE_WEIGHT,
  });
  return Object.freeze({
    ...resize,
    height: resize,
    width: resize,
  });
}

export const DOCK_SURFACE_RESIZE_TRANSITION =
  createDockSurfaceResizeTransition(260);

export const DOCK_SURFACE_STACK_ARRIVAL_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.EXPAND,
  ease: DOCK_EASINGS.SURFACE_ARRIVAL,
});

export function getDockSurfaceResizeTransition(distancePx: number) {
  return createDockSurfaceResizeTransition(distancePx);
}

export const DOCK_SURFACE_BODY_STEP_TRANSITION = contentSwapTransitions({
  duration: DOCK_DURATIONS.BASE,
  exitDuration: DOCK_DURATIONS.FAST,
  enterEase: DOCK_EASINGS.FLUID_RESIZE,
  exitEase: DOCK_EASINGS.EXIT,
}).enter;

export const DOCK_ACTION_DISMISS_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.ACTION_DISMISS,
  ease: DOCK_EASINGS.EXIT,
});

export const DOCK_HEADER_SWAP_TRANSITION = dockHeaderSwapTransitions.enter;

export const DOCK_SURFACE_CONTROLS_CONTAINER_TRANSITION =
  dockControlSwapTransitions.enter;

export const DOCK_SURFACE_CONTROLS_CONTAINER_EXIT_TRANSITION =
  dockControlSwapTransitions.exit;

export const DOCK_SURFACE_CONTROLS_ITEM_TRANSITION =
  dockControlSwapTransitions.enter;

export const DOCK_SURFACE_CONTROLS_ITEM_EXIT_TRANSITION =
  dockControlSwapTransitions.exit;

export const DOCK_SURFACE_CONTROLS_ACTION_TRANSITION =
  dockControlSwapTransitions.enter;

export const DOCK_SURFACE_CONTROLS_ACTION_EXIT_TRANSITION =
  dockControlSwapTransitions.exit;

export const DOCK_SURFACE_EXTENSIONS_ENTER_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.MODERATE,
  ease: DOCK_EASINGS.CINEMATIC,
});

export const DOCK_SURFACE_EXTENSIONS_EXIT_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.BASE,
  ease: DOCK_EASINGS.EXIT,
});

export const DOCK_CARD_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.COLLAPSE,
  ease: DOCK_EASINGS.SOFT,
});

export const DOCK_CARD_COLLAPSE_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.BASE,
  ease: DOCK_EASINGS.EXIT,
});

export const DOCK_PEEK_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.FAST,
  ease: DOCK_EASINGS.SOFT,
});

export const DOCK_CARD_SPRING = DOCK_SPRINGS.DECK;

export function getDockBackdropTransition({
  expanded = false,
  isSurface = false,
}: {
  expanded?: boolean;
  isSurface?: boolean;
} = {}) {
  return isSurface || expanded
    ? DOCK_CARD_EXPAND_TRANSITION
    : DOCK_STACK_TRANSITION;
}

export const DOCK_FADE_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_TIERS.STANDARD.duration,
  ease: DOCK_EASINGS.EMPHASIZED,
});

export const DOCK_TEXT_ENTER_TRANSITION = dockTextSwapTransitions.enter;

export const DOCK_TEXT_EXIT_TRANSITION = dockTextSwapTransitions.exit;

export const DOCK_ICON_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.FAST,
  ease: DOCK_EASINGS.SOFT,
});

export const DOCK_HUD_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.MODERATE,
  ease: DOCK_EASINGS.CINEMATIC,
});

export const DOCK_STAGGER_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.MODERATE,
  ease: DOCK_EASINGS.EMPHASIZED,
});

export const dockPressRole = press({
  tapScale: DOCK_TAP_SCALE,
  spring: DOCK_SPRINGS.PRESS,
});

export const DOCK_BUTTON_TRANSITION = dockPressRole.transition;

export const DOCK_BADGE_TRANSITION = DOCK_SPRINGS.BADGE;

export const DOCK_SCRUBBER_TOOLTIP_TRANSITION = Object.freeze({
  type: "tween" as const,
  duration: DOCK_DURATIONS.FAST,
  ease: DOCK_EASINGS.EMPHASIZED,
});

export const DOCK_SCRUBBER_TOOLTIP_SPRING = DOCK_SPRINGS.SCRUBBER_TOOLTIP;

const DOCK_EASING_CSS = `cubic-bezier(${DOCK_EASINGS.FLUID.join(", ")})`;

const DOCK_FAST_MS = `${Math.round(DOCK_DURATIONS.FAST * 1000)}ms`;

export const DOCK_MEDIA_VOLUME_FILL_TRANSITION = `width ${DOCK_FAST_MS} ${DOCK_EASING_CSS}`;

export const DOCK_MEDIA_VOLUME_THUMB_POSITION_TRANSITION = `left ${DOCK_FAST_MS} ${DOCK_EASING_CSS}`;

export const DOCK_SKELETON_PULSE_CLASS =
  "animate-pulse motion-reduce:animate-none";

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

export const dockActionVariants = dockPressRole.variants;

export const dockMediaVolumeThumbVariants = Object.freeze({
  idle: Object.freeze({
    scale: 1,
  }),
  dragging: Object.freeze({
    scale: 1.18,
  }),
});

function buildVariants(
  tierName: keyof typeof DOCK_TIERS,
  { distanceScale = 0 }: { distanceScale?: number } = {},
): Variants {
  const tier = DOCK_TIERS[tierName];
  const distance = Math.round(tier.distance * distanceScale);
  const exitDuration = Math.min(tier.duration * 0.7, DOCK_DURATIONS.MODERATE);
  const hidden: TargetAndTransition = {
    opacity: 0,
  };
  const visible: TargetAndTransition = {
    opacity: 1,
    transition: {
      duration: tier.duration,
      ease: tier.ease,
    },
  };
  const exit: TargetAndTransition = {
    opacity: 0,
    transition: {
      duration: exitDuration,
      ease: DOCK_EASINGS.EXIT,
    },
  };
  if (distance) {
    hidden.transform = toGpuTransform(distance, 1 - tier.scaleDelta);
    visible.transform = toGpuTransform(0);
    exit.transform = toGpuTransform(distance, 1 - tier.scaleDelta);
  }
  return Object.freeze({
    hidden,
    visible,
    exit,
  });
}

export const textCrossfadeVariants = buildVariants("STANDARD", {
  distanceScale: 0.42,
});

export const dockHeaderSwapVariants = contentSwap({
  travel: 4,
  exitTravel: 4,
  duration: DOCK_DURATIONS.HEADER,
  exitDuration: DOCK_DURATIONS.FAST,
  enterEase: DOCK_EASINGS.FLUID,
  exitEase: DOCK_EASINGS.EXIT,
});

export const dockExtensionShelfVariants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: toGpuTransform(5, 0.99),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(0, 1),
    transition: DOCK_SURFACE_EXTENSIONS_ENTER_TRANSITION,
  },
  exit: {
    opacity: 0,
    transform: toGpuTransform(-4, 0.99),
    transition: DOCK_SURFACE_EXTENSIONS_EXIT_TRANSITION,
  },
});

export const dockHeaderRestoreVariants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: toGpuTransform(-4, 0.99),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(0),
    transition: DOCK_SURFACE_HEADER_RESTORE_TRANSITION,
  },
  exit: {
    opacity: 0,
    transform: toGpuTransform(4, 0.99),
    transition: DOCK_TEXT_EXIT_TRANSITION,
  },
});

export const dockSurfaceControlsContainerVariants = Object.freeze({
  hidden: (targetY: unknown = 0) => ({
    opacity: 0,
    transform: toGpuTransform((Number(targetY) || 0) + 6, 0.97),
    transition: DOCK_SURFACE_CONTROLS_CONTAINER_EXIT_TRANSITION,
  }),
  visible: (targetY: unknown = 0) => ({
    opacity: 1,
    transform: toGpuTransform(Number(targetY) || 0, 1),
    transition: DOCK_SURFACE_CONTROLS_CONTAINER_TRANSITION,
  }),
  exit: (targetY: unknown = 0) => ({
    opacity: 0,
    transform: toGpuTransform((Number(targetY) || 0) + 6, 0.97),
    transition: DOCK_SURFACE_CONTROLS_CONTAINER_EXIT_TRANSITION,
  }),
});

export const dockSurfaceControlsActionVariants = Object.freeze({
  hidden: {
    opacity: 0,
    scale: 0.96,
    width: 0,
    marginRight: -2,
  },
  visible: {
    opacity: 1,
    scale: 1,
    width: "auto",
    marginRight: 0,
    transition: DOCK_SURFACE_CONTROLS_ACTION_TRANSITION,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    width: 0,
    marginRight: -2,
    transition: DOCK_SURFACE_CONTROLS_ACTION_EXIT_TRANSITION,
  },
});

export const dockSurfaceControlsBackVariants = Object.freeze({
  hidden: {
    opacity: 0,
    scale: 0.96,
    width: 0,
    marginRight: -2,
  },
  visible: {
    opacity: 1,
    scale: 1,
    width: "auto",
    marginRight: 0,
    transition: DOCK_SURFACE_CONTROLS_ITEM_TRANSITION,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    width: 0,
    marginRight: -2,
    transition: DOCK_SURFACE_CONTROLS_ITEM_EXIT_TRANSITION,
  },
});

export const dockSurfaceControlsCloseVariants = chip({
  duration: DOCK_DURATIONS.BASE,
  exitDuration: DOCK_DURATIONS.FAST,
  enterEase: DOCK_EASINGS.FLUID,
  exitEase: DOCK_EASINGS.EXIT,
});

export const dockCommandBarSwapVariants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: "translate3d(5px, 0, 0) scale(0.97)",
  },
  visible: (customIndex: unknown = 0) => ({
    opacity: 1,
    transform: "translate3d(0px, 0, 0) scale(1)",
    transition: {
      duration: DOCK_DURATIONS.BASE,
      delay: staggerDelay(Number(customIndex) || 0, {
        base: DOCK_STAGGER_TIMINGS.FAST,
        cap: 0.12,
      }),
      ease: DOCK_EASINGS.FLUID,
    },
  }),
  exit: {
    opacity: 0,
    transform: "translate3d(4px, 0, 0) scale(0.98)",
    transition: {
      duration: DOCK_DURATIONS.FAST,
      ease: DOCK_EASINGS.EXIT,
    },
  },
});

export const dockActionDismissVariants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: toGpuTransform(6, 0.99),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(0),
    transition: {
      duration: DOCK_DURATIONS.FAST,
      ease: DOCK_EASINGS.SOFT,
    },
  },
  exit: {
    opacity: 0,
    transform: toGpuTransform(-5, 0.99),
    transition: {
      duration: DOCK_DURATIONS.ACTION_DISMISS,
      ease: DOCK_EASINGS.EXIT,
    },
  },
});

const dockListStaggerRole = staggerItem({
  base: DOCK_STAGGER_TIMINGS.STANDARD,
  cap: 0.18,
  duration: DOCK_STAGGER_TRANSITION.duration,
  travel: 7,
  enterEase: DOCK_STAGGER_TRANSITION.ease,
  exitDuration: DOCK_TEXT_EXIT_TRANSITION.duration,
  exitEase: DOCK_TEXT_EXIT_TRANSITION.ease,
});

export const dockListItemVariants = Object.freeze({
  hidden: dockListStaggerRole.hidden,
  visible: (index: unknown = 0) =>
    dockListStaggerRole.visible(Number(index) || 0),
  exit: dockListStaggerRole.exit,
});

export const dockFadeVariants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: toGpuTransform(6, 0.99),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(0),
    transition: DOCK_TEXT_ENTER_TRANSITION,
  },
  exit: {
    opacity: 0,
    transform: toGpuTransform(-4, 0.99),
    transition: DOCK_TEXT_EXIT_TRANSITION,
  },
});

export const dockIconVariants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: toGpuTransform(0, 0.92),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(0, 1),
    transition: {
      duration: DOCK_DURATIONS.FAST,
      ease: DOCK_EASINGS.SOFT,
    },
  },
  exit: {
    opacity: 0,
    transform: toGpuTransform(0, 0.92),
    transition: {
      duration: DOCK_DURATIONS.FAST,
      ease: DOCK_EASINGS.EXIT,
    },
  },
});

export const dockBadgeVariants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: toGpuTransform(0, 0.88),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(0),
  },
  exit: {
    opacity: 0,
    transform: toGpuTransform(0, 0.9),
  },
});

export const dockBackdropVariants = Object.freeze({
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
});

export const dockBreadcrumbsVariants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: toGpuTransform(-5, 0.985),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(0),
    transition: DOCK_CARD_EXPAND_TRANSITION,
  },
  exit: {
    opacity: 0,
    transform: toGpuTransform(-3, 0.99),
    transition: DOCK_CARD_TRANSITION,
  },
});

export const dockHudVariants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: toGpuTransform(4, 0.99),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(0),
    transition: DOCK_HUD_TRANSITION,
  },
  exit: {
    opacity: 0,
    transform: toGpuTransform(3, 0.99),
    transition: DOCK_TEXT_EXIT_TRANSITION,
  },
});

export const dockScrubberTooltipVariants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: toGpuTransform(4, 0.98),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(0),
  },
  exit: {
    opacity: 0,
    transform: toGpuTransform(3, 0.99),
  },
});

export function getDockDescriptionVariants(targetOpacity = 0.7) {
  return {
    hidden: {
      opacity: 0,
      transform: toGpuTransform(4, 0.99),
    },
    visible: {
      opacity: targetOpacity,
      transform: toGpuTransform(0),
      transition: {
        duration: DOCK_DURATIONS.BASE,
        ease: DOCK_EASINGS.EMPHASIZED,
      },
    },
    exit: {
      opacity: 0,
      transform: toGpuTransform(-3, 0.99),
      transition: {
        duration: DOCK_DURATIONS.FAST,
        ease: DOCK_EASINGS.EXIT,
      },
    },
  };
}

export function getDockActionMotionProps({
  disabled = false,
  reduceMotion = false,
}: {
  disabled?: boolean;
  reduceMotion?: boolean;
} = {}) {
  const canMove = !disabled && !reduceMotion;
  return {
    initial: false as const,
    animate: "idle",
    whileTap: canMove ? "tap" : undefined,
    variants: dockActionVariants,
    transition: DOCK_BUTTON_TRANSITION,
  };
}

export function getDockMediaVolumeFillTransition({
  isDragging = false,
}: { isDragging?: boolean } = {}) {
  return isDragging ? "none" : DOCK_MEDIA_VOLUME_FILL_TRANSITION;
}

export function getDockMediaVolumeThumbAnimateProps({
  isDragging = false,
}: {
  isDragging?: boolean;
} = {}) {
  return isDragging
    ? dockMediaVolumeThumbVariants.dragging
    : dockMediaVolumeThumbVariants.idle;
}

export function getDockMediaVolumeThumbPositionTransition({
  isDragging = false,
}: {
  isDragging?: boolean;
} = {}) {
  return isDragging ? "none" : DOCK_MEDIA_VOLUME_THUMB_POSITION_TRANSITION;
}

function getDockSurfaceStackScale(surfacePhase?: string | null): number {
  if (surfacePhase === DOCK_SURFACE_PHASE.DISMISSING_ACTION) {
    return DOCK_SURFACE_STACK_SCALE.OPEN_ANTICIPATION_COMPRESS;
  }
  if (surfacePhase === DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION) {
    return DOCK_SURFACE_STACK_SCALE.CLOSE_ANTICIPATION_COMPRESS;
  }
  return DOCK_SURFACE_STACK_SCALE.REST;
}

export function getDockStackTransformTransition(
  surfacePhase: string | null | undefined,
  fallbackTransition: Transition,
) {
  if (surfacePhase === DOCK_SURFACE_PHASE.EXPANDING_BODY) {
    return DOCK_SURFACE_STACK_ARRIVAL_TRANSITION;
  }
  if (
    surfacePhase === DOCK_SURFACE_PHASE.DISMISSING_ACTION ||
    surfacePhase === DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION
  ) {
    return DOCK_SURFACE_ANTICIPATION_HIDE_TRANSITION;
  }
  return fallbackTransition;
}

export function getDockStackAnimateProps({
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
}) {
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
      getDockSurfaceStackScale(surfacePhase),
    ),
    opacity: isFullscreen ? 0 : 1,
    boxShadow: isSurfaceActive
      ? DOCK_STACK_ELEVATION.ELEVATED
      : DOCK_STACK_ELEVATION.REST,
    pointerEvents: isFullscreen ? ("none" as const) : ("auto" as const),
  };
}

export function getDockCardDelay({
  expanded = false,
  isStackHovered = false,
  position = 0,
}: {
  expanded?: boolean;
  isStackHovered?: boolean;
  position?: number;
} = {}) {
  const safePosition = Math.max(0, Number(position) || 0);
  if (expanded && safePosition > 0) {
    return staggerDelay(safePosition, {
      base: DOCK_STAGGER_TIMINGS.EXPAND,
      cap: 0.16,
    });
  }
  if (isStackHovered && safePosition > 0) {
    return staggerDelay(safePosition - 1, {
      base: DOCK_STAGGER_TIMINGS.PEEK,
      cap: 0.064,
    });
  }
  return 0;
}

export interface DockItemMotionValues {
  opacity: number;
  scale: number;
  y: number;
}

export function getDockItemAnimateValues({
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
} = {}) {
  if (!motionValues) return {};
  const safePosition = Math.max(0, Number(position) || 0);
  const isHoveredOffset =
    !expanded && isStackHovered && safePosition > 0 && !isSurfaceActive;
  const peekProgress = Math.min(safePosition / 3, 1);
  const peekOffset = DOCK_TIERS.MICRO.distance * (0.85 + peekProgress * 0.35);
  const peekScale = DOCK_TIERS.MICRO.scaleDelta * (1 - peekProgress * 0.25);
  const y = isHoveredOffset
    ? motionValues.y - safePosition * peekOffset
    : motionValues.y;
  const scale = isHoveredOffset
    ? motionValues.scale * (1 + peekScale)
    : motionValues.scale;

  return {
    transform: toGpuTransform(y, scale),
    opacity: motionValues.opacity,
  };
}

export function getDockItemTransition({
  expanded = false,
  isStackHovered = false,
  position = 0,
  delay = 0,
}: {
  expanded?: boolean;
  isStackHovered?: boolean;
  position?: number;
  delay?: number;
} = {}) {
  const safePosition = Math.max(0, Number(position) || 0);
  const baseTransition = expanded
    ? DOCK_CARD_SPRING
    : isStackHovered && safePosition > 0
      ? DOCK_PEEK_TRANSITION
      : DOCK_CARD_TRANSITION;
  return {
    ...baseTransition,
    delay: Number(delay) || 0,
  };
}

export function getDockItemExitValues({
  motionValues,
  position = 0,
}: {
  motionValues?: DockItemMotionValues;
  position?: number;
} = {}) {
  const safePosition = Math.max(0, Number(position) || 0);
  const targetY =
    motionValues && Number.isFinite(motionValues.y)
      ? motionValues.y
      : safePosition * DOCK_CARD_DIMENSIONS.collapsedY;
  const targetScale =
    motionValues && Number.isFinite(motionValues.scale)
      ? motionValues.scale * 0.98
      : 0.98 - Math.min(safePosition * 0.008, 0.024);

  return {
    opacity: 0,
    transform: toGpuTransform(targetY, targetScale),
    transition: {
      ...DOCK_CARD_COLLAPSE_TRANSITION,
    },
  };
}

export function getDockCardContentAnimateProps({
  expanded = false,
  position = 0,
  isExtensionShelf = false,
}: {
  expanded?: boolean;
  position?: number;
  isExtensionShelf?: boolean;
} = {}) {
  const isHidden = !expanded && position > 0 && !isExtensionShelf;
  return {
    opacity: isHidden ? 0 : 1,
    transform: toGpuTransform(
      isHidden ? DOCK_TIERS.STANDARD.distance * 0.35 : 0,
      isHidden ? 1 - DOCK_TIERS.MICRO.scaleDelta : 1,
    ),
  };
}
