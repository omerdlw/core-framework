import { REDUCED_MOTION_TRANSITION } from "./motion";

// Motion is owned by the app, like its styles. The app names its own
// durations, easings and springs and writes every module's motion with them;
// the framework only reads the tempo and the reduced-motion policy, and applies
// both to whatever the app wrote.

export type MotionEase = readonly [number, number, number, number];

export type ReducedMotionPolicy = "user" | "always" | "never";

export interface MotionSpring {
  readonly type?: "spring";
  readonly stiffness?: number;
  readonly damping?: number;
  readonly mass?: number;
  readonly bounce?: number;
  readonly visualDuration?: number;
}

export interface MotionTokensInput {
  /** Stretches every module duration, delay, stagger, timer and spring. */
  readonly tempo?: number;
  /** "user" follows the OS setting. */
  readonly reducedMotion?: ReducedMotionPolicy;
  readonly durations?: Readonly<Record<string, number>>;
  readonly easings?: Readonly<Record<string, MotionEase>>;
  readonly springs?: Readonly<Record<string, MotionSpring>>;
}

export type MotionTokens<T extends MotionTokensInput = MotionTokensInput> =
  Readonly<
    Omit<T, "tempo" | "reducedMotion"> & {
      tempo: number;
      reducedMotion: ReducedMotionPolicy;
    }
  >;

export function defineMotion<T extends MotionTokensInput>(
  tokens: T,
): MotionTokens<T> {
  const tempo = tokens.tempo ?? 1;
  if (!Number.isFinite(tempo) || tempo <= 0) {
    throw new Error(`Motion tempo must be a positive number, got ${tempo}.`);
  }
  return Object.freeze({
    ...tokens,
    tempo,
    reducedMotion: tokens.reducedMotion ?? "user",
  }) as MotionTokens<T>;
}

export interface MotionClock {
  readonly tempo: number;
  readonly reduced: boolean;
}

const TIME_KEYS = [
  "duration",
  "delay",
  "delayChildren",
  "staggerChildren",
  "repeatDelay",
  "visualDuration",
] as const;

const REDUCED = Object.freeze({
  type: "tween" as const,
  ...REDUCED_MOTION_TRANSITION,
});

type Plain = Record<string, unknown>;

function isPlainObject(value: unknown): value is Plain {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSpring(value: Plain): boolean {
  return (
    value.type === "spring" ||
    typeof value.stiffness === "number" ||
    typeof value.damping === "number"
  );
}

function isTransition(value: Plain): boolean {
  return (
    isSpring(value) ||
    TIME_KEYS.some((key) => typeof value[key] === "number")
  );
}

function retimeTransition(value: Plain, clock: MotionClock): Plain {
  if (clock.reduced) return { ...REDUCED };
  const { tempo } = clock;
  const next: Plain = {};
  for (const [key, entry] of Object.entries(value)) {
    next[key] = isPlainObject(entry) ? retimeNode(entry, clock) : entry;
  }
  for (const key of TIME_KEYS) {
    if (typeof value[key] === "number") next[key] = (value[key] as number) * tempo;
  }
  // A spring takes tempo× as long at the same damping ratio when its
  // stiffness falls by tempo² and its damping by tempo.
  if (typeof value.stiffness === "number") {
    next.stiffness = value.stiffness / (tempo * tempo);
  }
  if (typeof value.damping === "number") next.damping = value.damping / tempo;
  return next;
}

function retimeNode(value: unknown, clock: MotionClock): unknown {
  if (typeof value === "function") {
    const fn = value as (...args: unknown[]) => unknown;
    return (...args: unknown[]) => retimeNode(fn(...args), clock);
  }
  if (!isPlainObject(value)) return value;
  if (isTransition(value)) return retimeTransition(value, clock);
  const next: Plain = {};
  for (const [key, entry] of Object.entries(value)) {
    next[key] = retimeNode(entry, clock);
  }
  return next;
}

/** Applies tempo, or the reduced-motion collapse, to transitions anywhere in a motion tree. */
export function retime<T>(value: T, clock: MotionClock): T {
  if (clock.tempo === 1 && !clock.reduced) return value;
  return retimeNode(value, clock) as T;
}

function retimeSeconds(value: unknown, clock: MotionClock): unknown {
  if (typeof value === "number") {
    return clock.reduced
      ? Math.min(value, REDUCED.duration)
      : value * clock.tempo;
  }
  if (!isPlainObject(value)) return value;
  const next: Plain = {};
  for (const [key, entry] of Object.entries(value)) {
    next[key] = retimeSeconds(entry, clock);
  }
  return next;
}

/**
 * Retimes a module's resolved motion. Every number under its `timings` key is
 * seconds (choreography timers, staggers); everything else is walked for
 * transitions.
 */
export function retimeModuleMotion<M>(motion: M, clock: MotionClock): M {
  if (clock.tempo === 1 && !clock.reduced) return motion;
  if (!isPlainObject(motion)) return retime(motion, clock);
  const next: Plain = {};
  for (const [key, entry] of Object.entries(motion)) {
    next[key] =
      key === "timings" ? retimeSeconds(entry, clock) : retimeNode(entry, clock);
  }
  return next as M;
}

export function cssEasing(ease: unknown): string {
  if (Array.isArray(ease)) return `cubic-bezier(${ease.join(", ")})`;
  if (typeof ease === "string" && ease.trim()) return ease;
  return "ease";
}

/** A CSS `transition` value for one property, from a motion tween. */
export function cssTransition(
  property: string,
  transition: { duration?: number; delay?: number; ease?: unknown },
): string {
  const duration = `${Math.round((transition.duration ?? 0) * 1000)}ms`;
  const delay = transition.delay
    ? ` ${Math.round(transition.delay * 1000)}ms`
    : "";
  return `${property} ${duration} ${cssEasing(transition.ease)}${delay}`;
}
