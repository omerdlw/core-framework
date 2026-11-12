import type { ClassValue } from "clsx";

import type { UiRegister } from "@/foundation/recipes";

import { ANATOMY, type Anatomy } from "./anatomy";
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

type Ease = readonly [number, number, number, number];

/**
 * A motion transition object.
 */
export type UiTransition = Readonly<Record<string, unknown>>;

/**
 * Named motion variants, each a transition or a function of a custom index.
 */
export type UiVariants = Readonly<
  Record<string, UiTransition | ((custom: number) => UiTransition)>
>;

/**
 * Motion settings that components read from the UI definition.
 */
export interface UiMotion {
  readonly follow?: UiTransition;
  readonly menu?: UiVariants;
  readonly option?: UiVariants;
  readonly glide?: { readonly duration: number; readonly ease: Ease };
}

/**
 * Icon names that components use for built-in glyphs.
 */
export interface UiIcons {
  readonly check?: string;
  readonly selected?: string;
  readonly chevron?: string;
  readonly previous?: string;
  readonly next?: string;
  readonly spinner?: string;
}

/**
 * Default texts used by components.
 */
export interface UiLabels {
  readonly loading: string;
  readonly placeholder: string;
  readonly empty: string;
  readonly previous: string;
  readonly next: string;
}

/**
 * The labels used when the UI definition does not override them.
 */
export const DEFAULT_LABELS: UiLabels = {
  loading: "Loading",
  placeholder: "Select an option...",
  empty: "No options available",
  previous: "Scroll left",
  next: "Scroll right",
};

type Parts = Readonly<Record<string, unknown>>;
type Registry = Readonly<Record<string, Parts>>;

/**
 * Per-component, per-part recipe overrides.
 */
export type UiPartOverrides<D extends Registry = Anatomy> = {
  readonly [C in keyof D]?: {
    readonly [P in keyof D[C]]?: RecipeOverride<VariantsOf<D[C][P]>>;
  };
} & Readonly<
  Record<
    string,
    Readonly<Record<string, RecipeOverride | RecipeDef>> | undefined
  >
>;

/**
 * Input of `defineUi`: part overrides, merge vocabulary, motion, icons and labels.
 */
export interface UiConfig {
  readonly parts?: UiPartOverrides;
  readonly merge?: MergeVocabulary;
  readonly motion?: UiMotion;
  readonly icons?: UiIcons;
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

/**
 * The compiled recipes of every component part, including app-defined ones.
 */
export type UiParts<O = {}> = {
  readonly [
    C in
      | keyof Anatomy
      | Exclude<
          keyof NonNullable<O extends { parts?: infer X } ? X : {}>,
          number | symbol
        >
  ]: C extends keyof Anatomy
    ? MergedParts<Anatomy[C], PartsOverride<O, C>>
    : MergedParts<{}, PartsOverride<O, C>>;
};

/**
 * A compiled UI definition: part recipes, class joiner, motion, icons and labels.
 */
export interface Ui<O = {}> {
  readonly parts: UiParts<O>;
  readonly cn: (...inputs: ClassValue[]) => string;
  readonly motion: UiMotion;
  readonly icons: UiIcons;
  readonly labels: UiLabels;
  readonly config: UiConfig;
}

type CompiledParts = Record<string, Recipe>;

function compileComponent(
  defaults: Parts,
  own: Record<string, RecipeOverride>,
  cn: (...inputs: ClassValue[]) => string,
): CompiledParts {
  const parts: CompiledParts = {};
  for (const part of new Set([...Object.keys(defaults), ...Object.keys(own)])) {
    const def = defaults[part]
      ? extendRecipe(defaults[part], own[part])
      : (own[part] as RecipeDef);
    parts[part] = compileRecipe(def, cn);
  }
  return parts;
}

function compileParts(
  config: UiConfig,
  cn: (...inputs: ClassValue[]) => string,
): Record<string, CompiledParts> {
  const out: Record<string, CompiledParts> = {};
  const overrides = (config.parts ?? {}) as Record<
    string,
    Record<string, RecipeOverride> | undefined
  >;
  const names = new Set([...Object.keys(ANATOMY), ...Object.keys(overrides)]);
  for (const component of names) {
    // ANATOMY is a literal table, indexed here by component name.
    const defaults = (ANATOMY as unknown as Registry)[component] ?? {};
    out[component] = compileComponent(defaults, overrides[component] ?? {}, cn);
  }
  return out;
}

/**
 * Compiles a UI definition from the built-in anatomy and the given overrides.
 */
export function defineUi<const O extends UiConfig = {}>(config?: O): Ui<O> {
  const own = (config ?? {}) as UiConfig;
  const cn = createCn(own.merge);
  return Object.freeze({
    // compileParts returns generic parts; the option type narrows them per component.
    parts: compileParts(own, cn) as unknown as UiParts<O>,
    cn,
    motion: Object.freeze({ ...own.motion }),
    icons: Object.freeze({ ...own.icons }),
    labels: Object.freeze({ ...DEFAULT_LABELS, ...own.labels }),
    config: own,
  });
}

/**
 * The UI definition used when the app does not provide one.
 */
export const defaultUi = defineUi();

/**
 * The app's UI definition type, taken from the `UiRegister` augmentation.
 */
export type RegisteredUi = UiRegister extends { ui: infer U }
  ? U
  : typeof defaultUi;

type RegisteredParts = RegisteredUi extends { parts: infer P } ? P : never;

/**
 * The variant props of one part of one component.
 */
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

/**
 * Extra class names keyed by part name for one component.
 */
export type PartClassNames<C extends keyof RegisteredParts> = {
  readonly [P in keyof RegisteredParts[C]]?: string;
};

type Choices<T, K> = K extends keyof T ? NonNullable<T[K]> : never;

/**
 * The combined variant props of several parts of one component.
 */
export type PartsProps<
  C extends keyof RegisteredParts,
  P extends keyof RegisteredParts[C],
> = {
  -readonly [
    K in P extends unknown ? keyof PartProps<C, P> : never
  ]?: P extends unknown ? Choices<PartProps<C, P>, K> : never;
};
