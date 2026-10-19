import { type Transition } from "motion/react";
import { cssEasing } from "@/tokens";
import { useModuleMotion } from "@/theme";
import { backgroundTheme } from "./constants";
import {
  type BackgroundAnimationConfig,
  type BackgroundMotion,
} from "./types";

export function useBackgroundMotion() {
  return useModuleMotion(backgroundTheme);
}

// A page's own animation wins field by field over the app's background motion.
export function getBackgroundMotionConfig(
  motion: BackgroundMotion,
  animation?: BackgroundAnimationConfig | null,
) {
  return {
    animate: animation?.animate ?? motion.animate,
    exit: animation?.exit ?? motion.exit,
    exitDurationFactor: Number(animation?.exitDurationFactor),
    initial: animation?.initial ?? motion.initial,
    transition: animation?.transition ?? motion.transition,
  };
}

export function getBackgroundExitTransition(
  motion: BackgroundMotion,
  config: ReturnType<typeof getBackgroundMotionConfig>,
): Transition {
  const own = config.exit.transition as
    | { duration?: number; ease?: unknown }
    | undefined;
  const fallback = motion.exit.transition as { ease?: unknown } | undefined;
  const factor = Number.isFinite(config.exitDurationFactor)
    ? Math.max(0, config.exitDurationFactor)
    : motion.exitDurationFactor;
  return {
    ...config.transition,
    delay: 0,
    duration:
      own?.duration ??
      (config.transition.duration ?? motion.transition.duration ?? 0) *
        factor,
    ease: own?.ease ?? fallback?.ease,
  } as Transition;
}

export function toCssDuration(seconds: unknown, fallback = 0): string {
  const value = Number(seconds);
  return `${Math.max(0, Number.isFinite(value) ? value : fallback) * 1000}ms`;
}

export function toCssDelay(seconds: unknown): string {
  const value = Number(seconds);
  return `${Math.max(0, Number.isFinite(value) ? value : 0) * 1000}ms`;
}

export function toCssEasing(easing: unknown): string {
  return cssEasing(easing);
}
