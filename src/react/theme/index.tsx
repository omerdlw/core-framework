"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import { type CSSProperties, type ReactNode, use, useMemo } from "react";

import {
  defineMotion,
  type MotionClock,
  type MotionTokens,
  NEUTRAL_TEMPO,
  retimeModuleMotion,
} from "@/foundation/utils/tempo";
import { getOrCreateGlobalContext } from "@/react/context";

/**
 * A theme's identity and, through its type parameters, its slot names and motion shape.
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

/**
 * The slot classes, styles and (when the spec has motion) motion of a theme.
 */
export type ThemeConfig<S extends string, M = never> = ThemeVisuals<S> &
  ([M] extends [never] ? { motion?: undefined } : { motion: M });

/**
 * The slot classes and styles a component receives from `useTheme`.
 */
export interface ResolvedTheme<S extends string> {
  readonly slots: Readonly<Record<S, string>>;
  readonly styles: Readonly<Partial<Record<S, CSSProperties>>>;
}

/**
 * A theme id paired with its configuration, as passed to `ThemeProvider`.
 */
export interface ThemeEntry {
  readonly id: string;
  readonly config: ThemeVisuals<string> & { motion?: unknown };
}

/**
 * Declares a theme's identity with its slot names and optional motion type.
 */
export function defineThemeSpec<S extends string, M = never>(
  id: string,
): ThemeSpec<S, M> {
  return Object.freeze({ id });
}

/**
 * Binds a configuration to a theme spec.
 */
export function defineTheme<S extends string, M = never>(
  spec: ThemeSpec<S, M>,
  config: ThemeConfig<NoInfer<S>, NoInfer<M>>,
): ThemeEntry {
  return { id: spec.id, config };
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
  tempo: NEUTRAL_TEMPO,
  tokens: DEFAULT_MOTION,
});
const MotionContext = getOrCreateGlobalContext<MotionState>(
  "MotionContext",
  NO_MOTION_PROVIDER,
);

interface MotionProviderProps {
  children?: ReactNode;
  tokens: MotionTokens;
}

function MotionProvider({ children, tokens }: MotionProviderProps) {
  const prefersReduced = useReducedMotion() === true;
  const reduced =
    tokens.reducedMotion === "always" ||
    (tokens.reducedMotion === "user" && prefersReduced);
  // stable identity: consumers subscribe by reference
  const state = useMemo<MotionState>(
    () =>
      Object.freeze({
        reduced,
        still: tokens.still,
        tempo: tokens.tempo,
        tokens,
      }),
    [reduced, tokens],
  );
  return <MotionContext value={state}>{children}</MotionContext>;
}

interface ThemeProviderProps {
  children?: ReactNode;
  motion?: MotionTokens;
  themes: readonly ThemeEntry[];
}

/**
 * Provides themes, and motion tokens when given, to the tree below it.
 */
export function ThemeProvider({
  children,
  motion,
  themes,
}: ThemeProviderProps) {
  // stable identity: consumers subscribe by reference
  const configs = useMemo(
    () => new Map(themes.map((entry) => [entry.id, entry.config])),
    [themes],
  );
  const inheritsMotion = use(MotionContext) !== NO_MOTION_PROVIDER;
  const providesMotion = Boolean(motion) || !inheritsMotion;
  const content = providesMotion ? (
    <MotionProvider tokens={motion ?? DEFAULT_MOTION}>
      {children}
    </MotionProvider>
  ) : (
    children
  );
  return <ThemeContext value={configs}>{content}</ThemeContext>;
}

function missingTheme(id: string): Error {
  return new Error(
    `Theme "${id}" is missing. Ensure its theme configuration is provided to <ThemeProvider themes={[...]}> (e.g. in src/config/ or your theme setup).`,
  );
}

/**
 * Returns the slot classes and styles configured for a theme spec.
 */
export function useTheme<S extends string>(
  spec: ThemeSpec<S, unknown>,
): ResolvedTheme<S> {
  const config = use(ThemeContext).get(spec.id);
  if (!config) throw missingTheme(spec.id);
  return {
    slots: config.slots,
    styles: config.styles ?? {},
  };
}

// Cached per motion state, so `useMotionTokens` returns a stable object without memo.
const motionTokens = new WeakMap<
  MotionState,
  MotionTokens & { readonly reduced: boolean }
>();

/**
 * Returns the current motion tokens plus whether motion is reduced.
 */
export function useMotionTokens<T extends MotionTokens = MotionTokens>(): T & {
  readonly reduced: boolean;
} {
  const state = use(MotionContext);
  let tokens = motionTokens.get(state);
  if (!tokens) {
    tokens = { ...state.tokens, reduced: state.reduced };
    motionTokens.set(state, tokens);
  }
  return tokens as T & { readonly reduced: boolean };
}

const resolvedMotion = new WeakMap<MotionState, WeakMap<object, unknown>>();

/**
 * Returns a theme's motion, retimed to the current tempo; throws if it has none.
 */
export function useModuleMotion<M>(spec: ThemeSpec<string, M>): M {
  const config = use(ThemeContext).get(spec.id);
  const state = use(MotionContext);
  if (!config) throw missingTheme(spec.id);
  if (!config.motion || typeof config.motion !== "object") {
    throw new Error(
      `Motion for theme "${spec.id}" is missing. Add \`motion\` to its defineTheme(...) next to \`slots\` (see docs/theming.md).`,
    );
  }
  return resolveModuleMotion(state, config.motion) as M;
}

/**
 * Like `useModuleMotion`, but returns null when the theme has no motion.
 */
export function useOptionalModuleMotion<M>(
  spec: ThemeSpec<string, M>,
): M | null {
  const motion = use(ThemeContext).get(spec.id)?.motion;
  const state = use(MotionContext);
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

interface ModuleMotionConfigProps {
  children?: ReactNode;
}

/**
 * Applies the motion tokens' reduced-motion policy to motion components below it.
 */
export function ModuleMotionConfig({ children }: ModuleMotionConfigProps) {
  const { tokens } = use(MotionContext);
  return (
    <MotionConfig reducedMotion={tokens.reducedMotion}>{children}</MotionConfig>
  );
}
