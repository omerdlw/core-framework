import type { Recipe } from "./recipe";

const names = new WeakMap<object, readonly string[]>();

export function variantNames(recipe: Recipe): readonly string[] {
  const def = recipe.def;
  let list = names.get(def);
  if (!list) {
    list = Object.keys(def.variants ?? {});
    names.set(def, list);
  }
  return list;
}

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
