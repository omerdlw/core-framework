import { isPlainObject } from "./object";

/**
 * A cubic-bezier easing as four control values.
 */
export type MotionEase = readonly [number, number, number, number];

/**
 * How reduced-motion preference is applied: follow the user, always, or never.
 */
export type ReducedMotionPolicy = "user" | "always" | "never";

/**
 * Spring transition settings.
 */
export interface MotionSpring {
  readonly type?: "spring";
  readonly stiffness?: number;
  readonly damping?: number;
  readonly mass?: number;
  readonly bounce?: number;
  readonly visualDuration?: number;
}

/**
 * Motion tokens as written by the app: tempo, policy, durations, easings and springs.
 */
export interface MotionTokensInput {
  readonly tempo?: number;
  readonly reducedMotion?: ReducedMotionPolicy;
  readonly durations?: Readonly<Record<string, number>>;
  readonly easings?: Readonly<Record<string, MotionEase>>;
  readonly springs?: Readonly<Record<string, MotionSpring>>;
  readonly still?: Readonly<Record<string, unknown>>;
}

/**
 * Motion tokens with `tempo` and `reducedMotion` resolved to concrete values.
 */
export type MotionTokens<T extends MotionTokensInput = MotionTokensInput> =
  Readonly<
    Omit<T, "tempo" | "reducedMotion"> & {
      tempo: number;
      reducedMotion: ReducedMotionPolicy;
    }
  >;

export const NEUTRAL_TEMPO = 1;

/**
 * Validates and freezes motion tokens, applying defaults for tempo and policy.
 */
export function defineMotion<T extends MotionTokensInput>(
  tokens: T,
): MotionTokens<T> {
  const tempo = tokens.tempo ?? NEUTRAL_TEMPO;
  if (!Number.isFinite(tempo) || tempo <= 0) {
    throw new Error(`Motion tempo must be a positive number, got ${tempo}.`);
  }
  return Object.freeze({
    ...tokens,
    tempo,
    reducedMotion: tokens.reducedMotion ?? "user",
  });
}

/**
 * The tempo and reduced-motion state used to retime transitions.
 */
export interface MotionClock {
  readonly tempo: number;
  readonly reduced: boolean;
  readonly still?: Readonly<Record<string, unknown>>;
}

const TIME_KEYS = [
  "duration",
  "delay",
  "delayChildren",
  "staggerChildren",
  "repeatDelay",
  "visualDuration",
] as const;

const INSTANT = Object.freeze({ type: "tween" as const, duration: 0 });

const stillOf = (clock: MotionClock): Record<string, unknown> =>
  clock.still ?? INSTANT;

type Plain = Record<string, unknown>;

function isSpring(value: Plain): boolean {
  return (
    value.type === "spring" ||
    typeof value.stiffness === "number" ||
    typeof value.damping === "number"
  );
}

function isTransition(value: Plain): boolean {
  return (
    isSpring(value) || TIME_KEYS.some((key) => typeof value[key] === "number")
  );
}

function retimeTransition(value: Plain, clock: MotionClock): Plain {
  if (clock.reduced) return { ...stillOf(clock) };
  const { tempo } = clock;
  const next: Plain = {};
  for (const [key, entry] of Object.entries(value)) {
    next[key] = isPlainObject(entry) ? retimeNode(entry, clock) : entry;
  }
  // Durations scale with tempo. Spring stiffness and damping are scaled so the
  // spring's timing follows tempo while its damping ratio stays the same.
  for (const key of TIME_KEYS) {
    if (typeof value[key] === "number") next[key] = value[key] * tempo;
  }
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

/**
 * Scales every transition inside a value by the clock's tempo, or replaces
 * them with the still transition when motion is reduced.
 */
export function retime<T>(value: T, clock: MotionClock): T {
  if (clock.tempo === NEUTRAL_TEMPO && !clock.reduced) return value;
  return retimeNode(value, clock) as T;
}

function retimeSeconds(value: unknown, clock: MotionClock): unknown {
  if (typeof value === "number") {
    return clock.reduced
      ? Math.min(value, Number(stillOf(clock).duration) || 0)
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
 * Like `retime`, for a module motion object whose `timings` entry is in
 * plain seconds.
 */
export function retimeModuleMotion<M>(motion: M, clock: MotionClock): M {
  if (clock.tempo === NEUTRAL_TEMPO && !clock.reduced) return motion;
  if (!isPlainObject(motion)) return retime(motion, clock);
  const next: Plain = {};
  for (const [key, entry] of Object.entries(motion)) {
    next[key] =
      key === "timings"
        ? retimeSeconds(entry, clock)
        : retimeNode(entry, clock);
  }
  return next as M;
}
