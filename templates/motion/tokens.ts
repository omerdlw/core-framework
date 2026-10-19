import { defineMotion } from "@omerdlw/base-framework/tokens";

// Your app's motion vocabulary. The framework ships no animation of its own:
// every module plays what your theme files give it, written with these words.
// This folder is the framework's original motion, as a starting point; copy it
// into your app (e.g. src/config/theme/motion/) and make it yours.
//
// tempo stretches everything a module animates (durations, delays, staggers,
// choreography timers, springs). Write values at tempo 1.
export const motion = defineMotion({
  tempo: 1,
  reducedMotion: "user",
  durations: {
    instant: 0.08,
    micro: 0.18,
    fast: 0.28,
    base: 0.36,
    moderate: 0.44,
    slow: 0.58,
    cinematic: 0.86,
  },
  easings: {
    // How things arrive.
    enter: [0.25, 1, 0.5, 1],
    // Arrivals that should read as a reveal.
    emphasized: [0.16, 1, 0.3, 1],
    // Heavy surfaces settling.
    weighted: [0.22, 1, 0.36, 1],
    // A move between two resting points.
    move: [0.65, 0, 0.35, 1],
    // How things leave.
    exit: [0.5, 0, 1, 1],
    // A landing that slightly overshoots.
    overshoot: [0.34, 1.56, 0.64, 1],
  },
  springs: {
    press: { type: "spring", stiffness: 420, damping: 34, mass: 0.35 },
    tap: { type: "spring", stiffness: 520, damping: 30, mass: 0.28 },
    badge: { type: "spring", stiffness: 360, damping: 30, mass: 0.45 },
    tooltip: { damping: 28, stiffness: 350 },
    deck: { type: "spring", stiffness: 210, damping: 34, mass: 1.2 },
    panel: { type: "spring", stiffness: 240, damping: 28, mass: 0.85 },
  },
});

export const tween = (duration: number, ease: readonly [number, number, number, number]) =>
  ({ type: "tween", duration, ease }) as const;
