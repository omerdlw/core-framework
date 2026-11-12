import { type ClassValue, clsx } from "clsx";

export type Classes =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly Classes[]
  | Readonly<Record<string, unknown>>;

export type VariantMap = Readonly<
  Record<string, Readonly<Record<string, Classes>>>
>;

type ValueOf<K> = K extends "true" | "false" ? boolean | K : K;

export type SelectionOf<V> = {
  -readonly [K in keyof V]?: ValueOf<keyof V[K] & string> | null;
};

type CompoundMatch<V> = {
  -readonly [K in keyof V]?:
    ValueOf<keyof V[K] & string> | readonly ValueOf<keyof V[K] & string>[];
};

export type CompoundVariant<V> = CompoundMatch<V> & {
  readonly class?: Classes;
  readonly className?: Classes;
};

export interface RecipeDef<V extends VariantMap = VariantMap> {
  readonly base?: Classes;
  readonly variants?: V;
  readonly compoundVariants?: readonly CompoundVariant<V>[];
  readonly defaultVariants?: SelectionOf<V>;
}

export interface RecipeOverride<V extends VariantMap = VariantMap> {
  readonly reset?: boolean;
  readonly base?: Classes;
  readonly variants?: {
    readonly [K in keyof V]?: {
      readonly [Value in keyof V[K]]?: Classes;
    } & Readonly<Record<string, Classes>>;
  } & Readonly<Record<string, Readonly<Record<string, Classes>>>>;
  readonly compoundVariants?: readonly ({
    readonly class?: Classes;
    readonly className?: Classes;
  } & Readonly<Record<string, unknown>>)[];
  readonly defaultVariants?: Readonly<Record<string, unknown>>;
}

export type VariantsOf<R> = R extends { readonly variants?: infer V }
  ? V extends VariantMap
    ? V
    : {}
  : {};

type Union<A, B> = {
  readonly [K in keyof A | keyof B]: (K extends keyof A ? A[K] : {}) &
    (K extends keyof B ? B[K] : {});
};

export type MergedVariants<D, O> = O extends { readonly reset: true }
  ? VariantsOf<O>
  : Union<VariantsOf<D>, VariantsOf<O>>;

export interface Recipe<V = VariantMap> {
  (
    props?: SelectionOf<V> & {
      readonly class?: Classes;
      readonly className?: Classes;
    },
  ): string;
  readonly def: RecipeDef;
}

export type RecipeProps<R> = R extends Recipe<infer V> ? SelectionOf<V> : never;

const key = (value: unknown): string | null =>
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- total coercion of an unknown value; objects stringify to "[object Object]" as before (behaviour kept in 6.0 restructure)
  value === null || value === undefined ? null : String(value);

function matches(
  selected: Record<string, string | null>,
  compound: Record<string, unknown>,
): boolean {
  for (const [name, wanted] of Object.entries(compound)) {
    if (name === "class" || name === "className") continue;
    const actual = selected[name] ?? null;
    if (Array.isArray(wanted)) {
      if (!wanted.some((one) => key(one) === actual)) return false;
    } else if (key(wanted) !== actual) {
      return false;
    }
  }
  return true;
}

export function resolveRecipe(
  def: RecipeDef,
  props: Record<string, unknown> = {},
): ClassValue[] {
  const out: ClassValue[] = [def.base];
  const variants = def.variants ?? {};
  const defaults = (def.defaultVariants ?? {}) as Record<string, unknown>;
  const selected: Record<string, string | null> = {};

  for (const name of Object.keys(variants)) {
    const value = props[name] === undefined ? defaults[name] : props[name];
    const chosen = key(value);
    selected[name] = chosen;
    if (chosen !== null) out.push(variants[name][chosen]);
  }
  for (const compound of def.compoundVariants ?? []) {
    if (matches(selected, compound)) {
      out.push(compound.class, compound.className);
    }
  }
  out.push(props.class as ClassValue, props.className as ClassValue);
  return out;
}

export function extendRecipe(
  base: RecipeDef,
  override: RecipeOverride | undefined,
): RecipeDef {
  if (!override) return base;
  const { reset, ...rest } = override;
  if (reset) return rest as RecipeDef;

  const variants: Record<string, Record<string, Classes>> = {};
  for (const [name, values] of Object.entries(base.variants ?? {})) {
    variants[name] = { ...values };
  }
  for (const [name, values] of Object.entries(rest.variants ?? {})) {
    const target = (variants[name] ??= {});
    for (const [value, classes] of Object.entries(values)) {
      target[value] =
        target[value] === undefined ? classes : [target[value], classes];
    }
  }

  return {
    base: rest.base === undefined ? base.base : [base.base, rest.base],
    variants,
    compoundVariants: [
      ...(base.compoundVariants ?? []),
      ...((rest.compoundVariants ?? []) as RecipeDef["compoundVariants"] &
        object),
    ],
    defaultVariants: {
      ...base.defaultVariants,
      ...(rest.defaultVariants as RecipeDef["defaultVariants"]),
    },
  };
}

export function defineRecipe<const V extends VariantMap = {}>(
  def: RecipeDef<V>,
): RecipeDef<V> {
  return def;
}

export function compileRecipe<V>(
  def: RecipeDef,
  merge: (...inputs: ClassValue[]) => string,
): Recipe<V> {
  const recipe = ((props?: Record<string, unknown>) =>
    merge(...resolveRecipe(def, props))) as Recipe<V>;
  Object.defineProperty(recipe, "def", { value: def, enumerable: true });
  return recipe;
}

export const joinClasses = (...inputs: Classes[]): string => clsx(inputs);
