"use client";

import {
  createElement,
  useContext,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { getOrCreateGlobalContext } from "@/kernel";
import {
  defineMotion,
  retimeModuleMotion,
  type MotionClock,
  type MotionTokens,
} from "@/tokens";

/**
 * A module's theme contract: the slots it styles and, for modules that
 * animate, the motion it plays. Both are written by the app.
 */
export interface ThemeSpec<S extends string = string, M = never> {
  readonly id: string;
  readonly _slots?: S;
  readonly _motion?: M;
}

interface ThemeVisuals<S extends string> {
  slots: Readonly<Record<S, string>>;
  styles?: Readonly<Partial<Record<S, CSSProperties>>>;
}

export type ThemeConfig<S extends string, M = never> = ThemeVisuals<S> &
  ([M] extends [never] ? { motion?: undefined } : { motion: M });

export interface ResolvedTheme<S extends string> {
  readonly slots: Readonly<Record<S, string>>;
  readonly styles: Readonly<Partial<Record<S, CSSProperties>>>;
}

export interface ThemeEntry {
  readonly id: string;
  readonly config: ThemeVisuals<string> & { motion?: unknown };
}

export function defineThemeSpec<S extends string, M = never>(
  id: string,
): ThemeSpec<S, M> {
  return Object.freeze({ id });
}

export function defineTheme<S extends string, M = never>(
  spec: ThemeSpec<S, M>,
  config: ThemeConfig<NoInfer<S>, NoInfer<M>>,
): ThemeEntry {
  return { id: spec.id, config: config as ThemeEntry["config"] };
}

const EMPTY: ReadonlyMap<string, ThemeEntry["config"]> = new Map();
const ThemeContext = getOrCreateGlobalContext<
  ReadonlyMap<string, ThemeEntry["config"]>
>("ThemeContext", EMPTY);

interface MotionState extends MotionClock {
  readonly tokens: MotionTokens;
}

const DEFAULT_MOTION = defineMotion({});
const NO_MOTION_PROVIDER: MotionState = Object.freeze({
  reduced: false,
  tempo: 1,
  tokens: DEFAULT_MOTION,
});
const MotionContext = getOrCreateGlobalContext<MotionState>(
  "MotionContext",
  NO_MOTION_PROVIDER,
);

function MotionProvider({
  children,
  tokens,
}: {
  children?: ReactNode;
  tokens: MotionTokens;
}) {
  const prefersReduced = useReducedMotion() === true;
  const reduced =
    tokens.reducedMotion === "always" ||
    (tokens.reducedMotion === "user" && prefersReduced);
  const state = useMemo<MotionState>(
    () => Object.freeze({ reduced, tempo: tokens.tempo, tokens }),
    [reduced, tokens],
  );
  return createElement(MotionContext.Provider, { value: state }, children);
}

export function ThemeProvider({
  children,
  motion,
  themes,
}: {
  children?: ReactNode;
  /** The app's motion tokens, from `defineMotion` (tempo, reduced-motion policy, vocabulary). */
  motion?: MotionTokens;
  themes: readonly ThemeEntry[];
}) {
  const configs = new Map(themes.map((entry) => [entry.id, entry.config]));
  // A nested ThemeProvider without motion keeps the app's motion from above.
  const inherited = useContext(MotionContext) !== NO_MOTION_PROVIDER;
  return createElement(
    ThemeContext.Provider,
    { value: configs },
    motion || !inherited
      ? createElement(
          MotionProvider,
          { tokens: motion ?? DEFAULT_MOTION },
          children,
        )
      : children,
  );
}

function missingTheme(id: string): Error {
  return new Error(
    `Theme "${id}" is missing. Ensure its theme configuration is provided to <ThemeProvider themes={[...]}> (e.g. in src/config/ or your theme setup).`,
  );
}

export function useTheme<S extends string>(
  spec: ThemeSpec<S, unknown>,
): ResolvedTheme<S> {
  const config = useContext(ThemeContext).get(spec.id);
  if (!config) throw missingTheme(spec.id);
  return {
    slots: config.slots,
    styles: config.styles ?? {},
  } as ResolvedTheme<S>;
}

export { useTheme as useModuleTheme };

/** The app's motion tokens, plus whether reduced motion is in effect. */
export function useMotionTokens<
  T extends MotionTokens = MotionTokens,
>(): T & { readonly reduced: boolean } {
  const state = useContext(MotionContext);
  return useMemo(
    () => ({ ...(state.tokens as T), reduced: state.reduced }),
    [state],
  );
}

const resolvedMotion = new WeakMap<MotionState, WeakMap<object, unknown>>();

/**
 * The motion a module plays, as the app wrote it in `defineTheme(spec, { motion })`,
 * retimed by the app's tempo or collapsed for reduced motion. Stable per
 * (tokens, theme) so it can be a dependency.
 */
export function useModuleMotion<M>(spec: ThemeSpec<string, M>): M {
  const config = useContext(ThemeContext).get(spec.id);
  const state = useContext(MotionContext);
  if (!config) throw missingTheme(spec.id);
  if (!config.motion || typeof config.motion !== "object") {
    throw new Error(
      `Motion for theme "${spec.id}" is missing. Add \`motion\` to its defineTheme(...) next to \`slots\` (start from the framework's templates/motion/).`,
    );
  }
  return resolveModuleMotion(state, config.motion) as M;
}

/** Like useModuleMotion, but null when the app hasn't themed the module. */
export function useOptionalModuleMotion<M>(
  spec: ThemeSpec<string, M>,
): M | null {
  const motion = useContext(ThemeContext).get(spec.id)?.motion;
  const state = useContext(MotionContext);
  if (!motion || typeof motion !== "object") return null;
  return resolveModuleMotion(state, motion) as M;
}

function resolveModuleMotion(state: MotionState, motion: object): unknown {
  let byConfig = resolvedMotion.get(state);
  if (!byConfig) {
    byConfig = new WeakMap();
    resolvedMotion.set(state, byConfig);
  }
  if (!byConfig.has(motion)) {
    byConfig.set(motion, retimeModuleMotion(motion, state));
  }
  return byConfig.get(motion);
}

/**
 * Applies the app's reduced-motion policy to the motion components inside a
 * module (positional values such as width, height, x and scale jump instead of
 * animating). CoreProvider wraps every module backdrop and overlay in it.
 */
export function ModuleMotionConfig({ children }: { children?: ReactNode }) {
  const { tokens } = useContext(MotionContext);
  return createElement(
    MotionConfig,
    { reducedMotion: tokens.reducedMotion },
    children,
  );
}
