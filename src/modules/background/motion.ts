import { type TargetAndTransition, type Transition } from "motion/react";
import { DURATION_TOKENS, EASING_CURVES } from "@/tokens";
import { type BackgroundAnimationConfig } from "./types";

const DEFAULT_MOTION = Object.freeze({
  animate: Object.freeze({
    opacity: 1,
  }),
  exit: Object.freeze({
    opacity: 0,
    transition: Object.freeze({
      duration: DURATION_TOKENS.SLOW,
      ease: EASING_CURVES.IN_CUBIC,
    }),
  }),
  initial: Object.freeze({
    opacity: 0,
  }),
  transition: Object.freeze({
    delay: 0,
    duration: DURATION_TOKENS.SLOW,
    ease: EASING_CURVES.OUT_QUART,
  }),
});

export function getBackgroundMotionConfig(
  animation?: BackgroundAnimationConfig | null,
) {
  return {
    animate:
      animation?.animate ?? (DEFAULT_MOTION.animate as TargetAndTransition),
    exit: animation?.exit ?? (DEFAULT_MOTION.exit as TargetAndTransition),
    exitDurationFactor: Number(animation?.exitDurationFactor),
    initial:
      animation?.initial ?? (DEFAULT_MOTION.initial as TargetAndTransition),
    transition:
      animation?.transition ?? (DEFAULT_MOTION.transition as Transition),
  };
}

export function toCssDuration(seconds: unknown): string {
  const value = Number(seconds);
  return `${Math.max(0, Number.isFinite(value) ? value : DURATION_TOKENS.SLOW) * 1000}ms`;
}

export function toCssDelay(seconds: unknown): string {
  const value = Number(seconds);
  return `${Math.max(0, Number.isFinite(value) ? value : 0) * 1000}ms`;
}

export function toCssEasing(easing: unknown): string {
  if (Array.isArray(easing)) {
    return `cubic-bezier(${easing.join(", ")})`;
  }
  if (typeof easing === "string" && easing.trim()) {
    return easing;
  }
  return "ease";
}
