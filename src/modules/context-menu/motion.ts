import { type Transition, type Variants } from "motion/react";
import { DURATION_TOKENS, EASING_CURVES } from "@/tokens";

const CONTEXT_MENU_EASINGS = Object.freeze({
  EMPHASIZED: EASING_CURVES.OUT_EXPO,
  SOFT: EASING_CURVES.OUT_QUINT,
  EXIT: EASING_CURVES.IN_CUBIC,
});

const CONTEXT_MENU_TIERS = Object.freeze({
  MICRO: {
    duration: DURATION_TOKENS.FAST,
    distance: 4,
    scaleDelta: 0.008,
    ease: CONTEXT_MENU_EASINGS.EMPHASIZED,
  },
});

function toGpuTransform({
  x = 0,
  y = 0,
  scale = 1,
}: { x?: number; y?: number; scale?: number } = {}) {
  return `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}

export const CONTEXT_MENU_MICRO_SPRING: Transition = Object.freeze({
  type: "spring" as const,
  stiffness: 520,
  damping: 30,
  mass: 0.28,
});

export const CONTEXT_MENU_ITEM_TAP = Object.freeze({
  transform: toGpuTransform({
    scale: 0.97,
  }),
});

export const menuContentVariants: Variants = Object.freeze({
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: CONTEXT_MENU_TIERS.MICRO.duration,
      ease: CONTEXT_MENU_EASINGS.SOFT,
      delay: 0.04,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: DURATION_TOKENS.MICRO,
      ease: CONTEXT_MENU_EASINGS.EXIT,
    },
  },
});

export const menuItemVariants: Variants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: toGpuTransform({
      y: CONTEXT_MENU_TIERS.MICRO.distance,
      scale: 0.992,
    }),
  },
  visible: (index = 0) => ({
    opacity: 1,
    transform: toGpuTransform(),
    transition: {
      duration: CONTEXT_MENU_TIERS.MICRO.duration,
      ease: CONTEXT_MENU_EASINGS.EMPHASIZED,
      delay: 0.04 + Math.min(Math.max(Number(index) || 0, 0) * 0.042, 0.21),
    },
  }),
  exit: {
    opacity: 0,
    transform: toGpuTransform({
      y: -3,
      scale: 0.994,
    }),
    transition: {
      duration: DURATION_TOKENS.MICRO,
      ease: CONTEXT_MENU_EASINGS.EXIT,
    },
  },
});

export const menuPopVariants: Variants = Object.freeze({
  hidden: {
    opacity: 0,
    transform: toGpuTransform({
      scale: 0.96,
    }),
    transformOrigin: "top left",
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(),
    transformOrigin: "top left",
    transition: {
      duration: CONTEXT_MENU_TIERS.MICRO.duration,
      ease: CONTEXT_MENU_EASINGS.EMPHASIZED,
    },
  },
  exit: {
    opacity: 0,
    transform: toGpuTransform({
      scale: 0.98,
    }),
    transformOrigin: "top left",
    transition: {
      duration: DURATION_TOKENS.MICRO,
      ease: CONTEXT_MENU_EASINGS.EXIT,
    },
  },
});
