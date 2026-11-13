/**
 * A class value: strings and numbers, nested arrays, and objects whose keys
 * apply when their value is truthy (the `clsx` contract).
 */
export type Classes =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly Classes[]
  | Readonly<Record<string, unknown>>;

/**
 * Variant names mapped to their values and the classes each applies.
 */
export type VariantMap = Readonly<
  Record<string, Readonly<Record<string, Classes>>>
>;

type ValueOf<K> = K extends "true" | "false" ? boolean | K : K;

/**
 * The props a recipe accepts to pick a value for each variant.
 */
export type SelectionOf<V> = {
  -readonly [K in keyof V]?: ValueOf<keyof V[K] & string> | null;
};

type CompoundMatch<V> = {
  -readonly [K in keyof V]?:
    ValueOf<keyof V[K] & string> | readonly ValueOf<keyof V[K] & string>[];
};

/**
 * Classes applied only when several variant values match together.
 */
export type CompoundVariant<V> = CompoundMatch<V> & {
  readonly class?: Classes;
  readonly className?: Classes;
};

/**
 * The declarative description of a recipe: base classes, variants, compounds and defaults.
 */
export interface RecipeDef<V extends VariantMap = VariantMap> {
  readonly base?: Classes;
  readonly variants?: V;
  readonly compoundVariants?: readonly CompoundVariant<V>[];
  readonly defaultVariants?: SelectionOf<V>;
}

/**
 * A partial recipe definition that extends, or with `reset` replaces, a default one.
 */
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

/**
 * A compiled recipe: call it with variant props to get a class string.
 */
export interface Recipe<V = VariantMap> {
  (
    props?: SelectionOf<V> & {
      readonly class?: Classes;
      readonly className?: Classes;
    },
  ): string;
  readonly def: RecipeDef;
}

/**
 * The variant props accepted by a recipe type.
 */
export type RecipeProps<R> = R extends Recipe<infer V> ? SelectionOf<V> : never;

const key = (value: unknown): string | null =>
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- total coercion of an unknown value; objects stringify to "[object Object]" as before (behaviour kept in 3.2 restructure)
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

/**
 * Resolves a recipe definition and props to the ordered class list before merging.
 */
export function resolveRecipe(
  def: RecipeDef,
  props: Record<string, unknown> = {},
): Classes[] {
  const out: Classes[] = [def.base];
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
  out.push(props.class as Classes, props.className as Classes);
  return out;
}

/**
 * Combines a default recipe definition with an override.
 */
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

/**
 * Declares a recipe definition with its variant types inferred.
 */
export function defineRecipe<const V extends VariantMap = {}>(
  def: RecipeDef<V>,
): RecipeDef<V> {
  return def;
}

/**
 * Turns a recipe definition into a callable recipe using the given class merger.
 */
export function compileRecipe<V>(
  def: RecipeDef,
  merge: (...inputs: Classes[]) => string,
): Recipe<V> {
  const recipe = ((props?: Record<string, unknown>) =>
    merge(...resolveRecipe(def, props))) as Recipe<V>;
  Object.defineProperty(recipe, "def", { value: def, enumerable: true });
  return recipe;
}

function appendClasses(value: Classes, out: string): string {
  if (!value) return out;
  if (typeof value === "string" || typeof value === "number") {
    return out ? `${out} ${value}` : String(value);
  }
  if (typeof value !== "object") return out;
  if (Array.isArray(value)) {
    let next = out;
    for (let index = 0; index < value.length; index += 1) {
      next = appendClasses((value as readonly Classes[])[index], next);
    }
    return next;
  }
  const record = value as Readonly<Record<string, unknown>>;
  let next = out;
  for (const key of Object.keys(record)) {
    if (record[key]) next = next ? `${next} ${key}` : key;
  }
  return next;
}

/**
 * Joins class values without Tailwind conflict resolution.
 */
export const joinClasses = (...inputs: Classes[]): string =>
  appendClasses(inputs, "");
