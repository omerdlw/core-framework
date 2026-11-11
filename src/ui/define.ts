import type { ClassValue } from "clsx";
import { createCn, type MergeVocabulary } from "./cn";
import {
  compileRecipe,
  extendRecipe,
  type MergedVariants,
  type Recipe,
  type RecipeDef,
  type RecipeOverride,
  type VariantsOf,
} from "./recipe";
import { DEFAULT_RECIPES, type DefaultRecipes } from "./defaults";
import type { UiRegister } from "./recipes";

type Ease = readonly [number, number, number, number];

export type UiTransition = Readonly<Record<string, unknown>>;

export interface UiMotion {
  readonly follow: UiTransition;
  readonly menu: { readonly enter: UiTransition; readonly exit: UiTransition };
  readonly option: UiTransition;
  readonly glide: { readonly duration: number; readonly ease: Ease };
  readonly timings: { readonly stagger: number };
  readonly staggerLimit: number;
}

export interface UiIcons {
  readonly check: string;
  readonly selected: string;
  readonly chevron: string;
  readonly previous: string;
  readonly next: string;
  readonly spinner: string;
}

export interface UiLabels {
  readonly loading: string;
  readonly placeholder: string;
  readonly empty: string;
  readonly previous: string;
  readonly next: string;
}

export const CURVES = {
  fade: [0.45, 0, 0.15, 1],
  silk: [0.5, 0.05, 0.1, 1],
  expo: [0.36, 0.08, 0.08, 1],
  glide: [0.65, 0, 0.35, 1],
  dolly: [0.5, 0, 0.12, 1],
} as const satisfies Record<string, Ease>;

const PHI = (1 + Math.sqrt(5)) / 2;

export const step = (rung: number): number => 0.5 * PHI ** rung;

export const DEFAULT_MOTION: UiMotion = {
  follow: { type: "spring", stiffness: 420, damping: 38, mass: 1 },
  menu: {
    enter: { duration: step(0), ease: CURVES.expo },
    exit: { duration: step(-2), ease: CURVES.glide },
  },
  option: { duration: step(-1), ease: CURVES.expo },
  glide: { duration: step(2), ease: CURVES.dolly },
  timings: { stagger: step(-5) },
  staggerLimit: 5,
};

export const DEFAULT_ICONS: UiIcons = {
  check: "material-symbols:check-rounded",
  selected: "solar:check-read-linear",
  chevron: "solar:alt-arrow-down-linear",
  previous: "solar:alt-arrow-left-bold",
  next: "solar:alt-arrow-right-bold",
  spinner: "mingcute:loading-3-fill",
};

export const DEFAULT_LABELS: UiLabels = {
  loading: "Loading",
  placeholder: "Select an option...",
  empty: "No options available",
  previous: "Scroll left",
  next: "Scroll right",
};

type Parts = { readonly [part: string]: unknown };
type Registry = { readonly [component: string]: Parts };

export type UiPartOverrides<D extends Registry = DefaultRecipes> = {
  readonly [C in keyof D]?: {
    readonly [P in keyof D[C]]?: RecipeOverride<VariantsOf<D[C][P]>>;
  };
} & {
  readonly [component: string]:
    { readonly [part: string]: RecipeOverride | RecipeDef } | undefined;
};

export interface UiConfig {
  readonly parts?: UiPartOverrides;
  readonly merge?: MergeVocabulary;
  readonly motion?: {
    readonly [K in keyof UiMotion]?: UiMotion[K] extends object
      ? Partial<UiMotion[K]>
      : UiMotion[K];
  };
  readonly icons?: Partial<UiIcons>;
  readonly labels?: Partial<UiLabels>;
}

type MergedParts<D extends Parts, O> = {
  readonly [P in keyof D | keyof O]: Recipe<
    P extends keyof D
      ? P extends keyof O
        ? MergedVariants<D[P], O[P]>
        : VariantsOf<D[P]>
      : P extends keyof O
        ? VariantsOf<O[P]>
        : {}
  >;
};

type PartsOverride<O, C> = O extends { readonly parts?: infer X }
  ? C extends keyof X
    ? NonNullable<X[C]>
    : {}
  : {};

export type UiParts<O = {}> = {
  readonly [
    C in
      | keyof DefaultRecipes
      | Exclude<
          keyof NonNullable<O extends { parts?: infer X } ? X : {}>,
          number | symbol
        >
  ]: C extends keyof DefaultRecipes
    ? MergedParts<DefaultRecipes[C], PartsOverride<O, C>>
    : MergedParts<{}, PartsOverride<O, C>>;
};

export interface Ui<O = {}> {
  readonly parts: UiParts<O>;
  readonly cn: (...inputs: ClassValue[]) => string;
  readonly motion: UiMotion;
  readonly icons: UiIcons;
  readonly labels: UiLabels;
  readonly config: UiConfig;
}

function compileParts(
  config: UiConfig,
  cn: (...inputs: ClassValue[]) => string,
): Record<string, Record<string, Recipe>> {
  const out: Record<string, Record<string, Recipe>> = {};
  const overrides = (config.parts ?? {}) as Record<
    string,
    Record<string, RecipeOverride> | undefined
  >;
  const names = new Set([
    ...Object.keys(DEFAULT_RECIPES),
    ...Object.keys(overrides),
  ]);
  for (const component of names) {
    const defaults = (DEFAULT_RECIPES as unknown as Registry)[component] ?? {};
    const own = overrides[component] ?? {};
    const parts: Record<string, Recipe> = {};
    for (const part of new Set([
      ...Object.keys(defaults),
      ...Object.keys(own),
    ])) {
      const def = defaults[part]
        ? extendRecipe(defaults[part], own[part])
        : (own[part] as RecipeDef);
      parts[part] = compileRecipe(def, cn);
    }
    out[component] = parts;
  }
  return out;
}

function mergeMotion(motion: UiConfig["motion"] = {}): UiMotion {
  return {
    follow: { ...DEFAULT_MOTION.follow, ...motion.follow },
    menu: { ...DEFAULT_MOTION.menu, ...motion.menu },
    option: { ...DEFAULT_MOTION.option, ...motion.option },
    glide: { ...DEFAULT_MOTION.glide, ...motion.glide },
    timings: { ...DEFAULT_MOTION.timings, ...motion.timings },
    staggerLimit: motion.staggerLimit ?? DEFAULT_MOTION.staggerLimit,
  };
}

export function defineUi<const O extends UiConfig = {}>(config?: O): Ui<O> {
  const own = (config ?? {}) as UiConfig;
  const cn = createCn(own.merge);
  return Object.freeze({
    parts: compileParts(own, cn) as unknown as UiParts<O>,
    cn,
    motion: Object.freeze(mergeMotion(own.motion)),
    icons: Object.freeze({ ...DEFAULT_ICONS, ...own.icons }),
    labels: Object.freeze({ ...DEFAULT_LABELS, ...own.labels }),
    config: own,
  });
}

export const defaultUi = defineUi();

export type RegisteredUi = UiRegister extends { ui: infer U }
  ? U
  : typeof defaultUi;

type RegisteredParts = RegisteredUi extends { parts: infer P } ? P : never;

export type PartProps<
  C extends keyof RegisteredParts,
  P extends keyof RegisteredParts[C],
> =
  RegisteredParts[C][P] extends Recipe<infer V>
    ? {
        -readonly [K in keyof V]?: keyof V[K] & string extends infer Key
          ? Key extends "true" | "false"
            ? boolean
            : Key
          : never;
      }
    : never;

export type PartClassNames<C extends keyof RegisteredParts> = {
  readonly [P in keyof RegisteredParts[C]]?: string;
};

type Choices<T, K> = K extends keyof T ? NonNullable<T[K]> : never;

export type PartsProps<
  C extends keyof RegisteredParts,
  P extends keyof RegisteredParts[C],
> = {
  -readonly [
    K in P extends unknown ? keyof PartProps<C, P> : never
  ]?: P extends unknown ? Choices<PartProps<C, P>, K> : never;
};
