import type { Recipe } from "./recipe";

const names = new WeakMap<object, readonly string[]>();

/** The variant names a compiled recipe answers (defaults and the app's own). */
export function variantNames(recipe: Recipe): readonly string[] {
  const def = recipe.def;
  let list = names.get(def);
  if (!list) {
    list = Object.keys(def.variants ?? {});
    names.set(def, list);
  }
  return list;
}

/**
 * Splits a component's props into the variant choices of `recipes` and the
 * rest. A variant an app adds through `defineUi` arrives as a prop the
 * component never names; this keeps it for the recipe and off the DOM.
 */
export function splitVariants<P extends Record<string, unknown>>(
  props: P,
  ...recipes: Recipe[]
): [variants: Record<string, unknown>, rest: P] {
  const variants: Record<string, unknown> = {};
  const rest: Record<string, unknown> = { ...props };
  for (const recipe of recipes) {
    for (const name of variantNames(recipe)) {
      if (name in rest) {
        variants[name] = rest[name];
        delete rest[name];
      }
    }
  }
  return [variants, rest as P];
}
