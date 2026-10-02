import { type Variants } from "motion/react";
import { DURATION_TOKENS, EASING_CURVES } from "@/tokens";

function toGpuTransform(y = 0, scale = 1): string {
  return `translate3d(0, ${Math.round(y)}px, 0) scale(${Math.round(scale * 1000) / 1000})`;
}

export const NOTIFICATION_COMPOSITOR_STYLE = Object.freeze({
  WebkitBackfaceVisibility: "hidden" as const,
  WebkitFontSmoothing: "antialiased" as const,
  backfaceVisibility: "hidden" as const,
  transform: "translateZ(0)",
  willChange: "transform, opacity, filter",
});

export const NOTIFICATION_TRANSITION = Object.freeze({
  duration: DURATION_TOKENS.MODERATE,
  ease: EASING_CURVES.OUT_EXPO,
  type: "tween" as const,
});

const NOTIFICATION_EXIT_TRANSITION = Object.freeze({
  duration: DURATION_TOKENS.FAST,
  ease: EASING_CURVES.IN_CUBIC,
  type: "tween" as const,
});

export const toastVariants: Variants = Object.freeze({
  exit: {
    opacity: 0,
    transform: toGpuTransform(-6, 0.98),
    transition: NOTIFICATION_EXIT_TRANSITION,
  },
  hidden: {
    opacity: 0,
    transform: toGpuTransform(-10, 0.96),
  },
  visible: {
    opacity: 1,
    transform: toGpuTransform(0, 1),
    transition: NOTIFICATION_TRANSITION,
  },
});
