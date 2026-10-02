import { type Transition, type Variants } from "motion/react";
import { DURATION_TOKENS, EASING_CURVES, MOTION_TIERS } from "@/tokens";
import { MODAL_POSITIONS } from "./constants";
import { type ModalPosition } from "./types";

const MODAL_EASINGS = Object.freeze({
  CINEMATIC: EASING_CURVES.OUT_EXPO,
  EMPHASIZED: EASING_CURVES.OUT_EXPO,
  EXIT: EASING_CURVES.IN_CUBIC,
  FLUID: EASING_CURVES.OUT_QUART,
  FLUID_RESIZE: EASING_CURVES.OUT_QUART,
  PROGRESSIVE_EXIT: EASING_CURVES.IN_CUBIC,
  SOFT: EASING_CURVES.OUT_QUART,
  SOFT_EXIT: EASING_CURVES.IN_CUBIC,
} as const);

const MODAL_TIERS = MOTION_TIERS;

const MODAL_DURATIONS = Object.freeze({
  BACKDROP_EXIT: DURATION_TOKENS.FAST,
  BODY: DURATION_TOKENS.BASE,
  BODY_EXIT: DURATION_TOKENS.FAST,
  EDGE_EXIT: DURATION_TOKENS.FAST,
  FAST: DURATION_TOKENS.FAST,
  MODERATE: DURATION_TOKENS.MODERATE,
  SLOT: DURATION_TOKENS.BASE,
  SLOT_EXIT: DURATION_TOKENS.MICRO,
  SLOW: DURATION_TOKENS.SLOW,
} as const);

const MODAL_SPRINGS = Object.freeze({
  DECK: Object.freeze({
    damping: 28,
    mass: 0.85,
    stiffness: 240,
    type: "spring" as const,
  }),
  MICRO: Object.freeze({
    damping: 32,
    mass: 0.3,
    stiffness: 480,
    type: "spring" as const,
  }),
  PANEL: Object.freeze({
    damping: 28,
    mass: 0.85,
    stiffness: 240,
    type: "spring" as const,
  }),
} as const);

export const MODAL_COMPOSITOR_STYLE = Object.freeze({
  WebkitBackfaceVisibility: "hidden",
  WebkitFontSmoothing: "antialiased",
  backfaceVisibility: "hidden",
  transform: "translateZ(0)",
  willChange: "transform, opacity",
} as const);

function toCssDistance(value: number | string = 0) {
  return typeof value === "number" ? `${Math.round(value)}px` : value;
}

function toGpuTransform(
  yOrConfig?:
    | number
    | string
    | { scale?: number; x?: number | string; y?: number | string },
  scaleValue: number = 1,
): string {
  if (typeof yOrConfig === "object" && yOrConfig !== null) {
    const xVal = yOrConfig.x ?? 0;
    const yVal = yOrConfig.y ?? 0;
    const sVal = yOrConfig.scale ?? 1;
    const safeScale = Number.parseFloat(String(sVal));
    const roundedScale = Number.isFinite(safeScale)
      ? Math.round(safeScale * 1000) / 1000
      : 1;
    return `translate3d(${toCssDistance(xVal)}, ${toCssDistance(yVal)}, 0) scale(${roundedScale})`;
  }
  const safeY = Number.parseFloat(String(yOrConfig));
  const safeScale = Number.parseFloat(String(scaleValue));
  const roundedY = Number.isFinite(safeY) ? Math.round(safeY) : 0;
  const roundedScale = Number.isFinite(safeScale)
    ? Math.round(safeScale * 1000) / 1000
    : 1;
  return `translate3d(0, ${roundedY}px, 0) scale(${roundedScale})`;
}

const MODAL_PANEL_SPRING = MODAL_SPRINGS.PANEL;

const MODAL_BACKDROP_TRANSITION = Object.freeze({
  duration: MODAL_DURATIONS.SLOW,
  ease: MODAL_EASINGS.FLUID,
  type: "tween" as const,
});

const MODAL_BACKDROP_EXIT_TRANSITION = Object.freeze({
  duration: MODAL_DURATIONS.BACKDROP_EXIT,
  ease: MODAL_EASINGS.FLUID,
  type: "tween" as const,
});

const MODAL_SURFACE_ENTER_TRANSITION = Object.freeze({
  duration: MODAL_DURATIONS.SLOW,
  ease: MODAL_EASINGS.FLUID,
  type: "tween" as const,
});

const MODAL_SURFACE_EXIT_TRANSITION = Object.freeze({
  duration: MODAL_DURATIONS.EDGE_EXIT,
  ease: MODAL_EASINGS.EXIT,
  type: "tween" as const,
});

const MODAL_BODY_ENTER_TRANSITION = Object.freeze({
  delay: 0.04,
  duration: MODAL_DURATIONS.BODY,
  ease: MODAL_EASINGS.FLUID,
  type: "tween" as const,
});

const MODAL_BODY_EXIT_TRANSITION = Object.freeze({
  duration: MODAL_DURATIONS.BODY_EXIT,
  ease: MODAL_EASINGS.EXIT,
  type: "tween" as const,
});

export const MODAL_CONTENT_VARIANTS: Variants = Object.freeze({
  exit: {
    opacity: 0,
    transform: toGpuTransform({
      scale: 0.98,
      y: 12,
    }),
    transition: MODAL_BODY_EXIT_TRANSITION,
  },
  hidden: {
    opacity: 0,
    transform: toGpuTransform({
      scale: 0.98,
      y: 12,
    }),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(),
    transition: MODAL_BODY_ENTER_TRANSITION,
  },
});

export const MODAL_HEADER_VARIANTS: Variants = Object.freeze({
  exit: {
    opacity: 0,
    transform: toGpuTransform({
      scale: 0.99,
      y: -6,
    }),
    transition: {
      duration: MODAL_DURATIONS.SLOT_EXIT,
      ease: MODAL_EASINGS.EXIT,
    },
  },
  hidden: {
    opacity: 0,
    transform: toGpuTransform({
      scale: 0.99,
      y: -6,
    }),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(),
    transition: {
      delay: 0.02,
      duration: MODAL_DURATIONS.SLOT,
      ease: MODAL_EASINGS.FLUID,
    },
  },
});

export const MODAL_FOOTER_VARIANTS: Variants = Object.freeze({
  exit: {
    opacity: 0,
    transform: toGpuTransform({
      scale: 0.99,
      y: 6,
    }),
    transition: {
      duration: MODAL_DURATIONS.SLOT_EXIT,
      ease: MODAL_EASINGS.EXIT,
    },
  },
  hidden: {
    opacity: 0,
    transform: toGpuTransform({
      scale: 0.99,
      y: 6,
    }),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(),
    transition: {
      delay: 0.06,
      duration: MODAL_DURATIONS.SLOT,
      ease: MODAL_EASINGS.FLUID,
    },
  },
});

function buildVariants(
  tierName: keyof typeof MODAL_TIERS,
  {
    axis,
    direction = 1,
    fullSlide = false,
  }: { axis: "x" | "y"; direction?: number; fullSlide?: boolean },
): Variants {
  const tier = MODAL_TIERS[tierName];
  const distance = fullSlide ? "100%" : tier.distance;
  const signedDistance =
    direction < 0 ? (fullSlide ? "-100%" : -Number(distance)) : distance;
  const transform =
    axis === "x"
      ? {
          x: signedDistance,
        }
      : {
          y: signedDistance,
        };
  return Object.freeze({
    exit: {
      opacity: 0,
      transform: toGpuTransform(transform),
      transition: MODAL_SURFACE_EXIT_TRANSITION,
    },
    hidden: {
      opacity: 0,
      transform: toGpuTransform(transform),
    },
    visible: {
      opacity: 1,
      transform: toGpuTransform(),
      transition: MODAL_SURFACE_ENTER_TRANSITION,
    },
  });
}

export const modalBackdropVariants: Variants = Object.freeze({
  exit: {
    opacity: 0,
    transition: MODAL_BACKDROP_EXIT_TRANSITION,
  },
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: MODAL_BACKDROP_TRANSITION,
  },
});

const CENTER_VARIANTS: Variants = Object.freeze({
  exit: {
    opacity: 0,
    transform: toGpuTransform({
      scale: 0.96,
      y: 8,
    }),
    transition: {
      duration: MODAL_DURATIONS.FAST,
      ease: MODAL_EASINGS.EXIT,
    },
  },
  hidden: {
    opacity: 0,
    transform: toGpuTransform({
      scale: 0.95,
      y: 12,
    }),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(),
    transition: {
      duration: MODAL_TIERS.STANDARD.duration,
      ease: MODAL_EASINGS.FLUID,
    },
  },
});

const BOTTOM_VARIANTS = buildVariants("SURFACE", {
  axis: "y",
  fullSlide: true,
});
const RIGHT_VARIANTS = buildVariants("SURFACE", {
  axis: "x",
  fullSlide: true,
});
const LEFT_VARIANTS = buildVariants("SURFACE", {
  axis: "x",
  direction: -1,
  fullSlide: true,
});
const TOP_VARIANTS = buildVariants("SURFACE", {
  axis: "y",
  direction: -1,
  fullSlide: true,
});

export function getModalPositionVariants(position: ModalPosition): Variants {
  switch (position) {
    case MODAL_POSITIONS.BOTTOM:
      return BOTTOM_VARIANTS;
    case MODAL_POSITIONS.RIGHT:
      return RIGHT_VARIANTS;
    case MODAL_POSITIONS.LEFT:
      return LEFT_VARIANTS;
    case MODAL_POSITIONS.TOP:
      return TOP_VARIANTS;
    case MODAL_POSITIONS.CENTER:
    default:
      return CENTER_VARIANTS;
  }
}

export function getModalTransition(
  position: ModalPosition,
): Transition | undefined {
  return position === MODAL_POSITIONS.CENTER ? MODAL_PANEL_SPRING : undefined;
}
