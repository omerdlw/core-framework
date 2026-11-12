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
import { ANATOMY, type Anatomy } from "./anatomy";
import type { UiRegister } from "./recipes";

type Ease = readonly [number, number, number, number];

export type UiTransition = Readonly<Record<string, unknown>>;

export type UiVariants = Readonly<
  Record<string, UiTransition | ((custom: number) => UiTransition)>
>;

export interface UiMotion {
  readonly follow?: UiTransition;
  readonly menu?: UiVariants;
  readonly option?: UiVariants;
  readonly glide?: { readonly duration: number; readonly ease: Ease };
}

export interface UiIcons {
  readonly check?: string;
  readonly selected?: string;
  readonly chevron?: string;
  readonly previous?: string;
  readonly next?: string;
  readonly spinner?: string;
}

export interface UiLabels {
  readonly loading: string;
  readonly placeholder: string;
  readonly empty: string;
  readonly previous: string;
  readonly next: string;
}

export const DEFAULT_LABELS: UiLabels = {
  loading: "Loading",
  placeholder: "Select an option...",
  empty: "No options available",
  previous: "Scroll left",
  next: "Scroll right",
};

type Parts = Readonly<Record<string, unknown>>;
type Registry = Readonly<Record<string, Parts>>;

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
  const names = new Set([...Object.keys(ANATOMY), ...Object.keys(overrides)]);
  for (const component of names) {
    // ANATOMY is a literal table, indexed here by component name.
    const defaults = (ANATOMY as unknown as Registry)[component] ?? {};
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
