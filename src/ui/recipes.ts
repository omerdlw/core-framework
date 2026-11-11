/*
 * @omerdlw/base-framework/ui/recipes — the server-safe half of the component
 * library: `defineUi`, the recipe engine, `createCn` and the default recipes.
 * Nothing here touches React, so a Server Component can compute a part's
 * classes (`ui.parts.button.root({ intent: "primary" })`).
 */

export {
  CURVES,
  DEFAULT_ICONS,
  DEFAULT_LABELS,
  DEFAULT_MOTION,
  defaultUi,
  defineUi,
  step,
  type PartClassNames,
  type PartProps,
  type PartsProps,
  type RegisteredUi,
  type Ui,
  type UiConfig,
  type UiIcons,
  type UiLabels,
  type UiMotion,
  type UiPartOverrides,
  type UiParts,
  type UiTransition,
} from "./define";
export {
  compileRecipe,
  defineRecipe,
  extendRecipe,
  joinClasses,
  resolveRecipe,
  type Classes,
  type CompoundVariant,
  type Recipe,
  type RecipeDef,
  type RecipeOverride,
  type RecipeProps,
  type SelectionOf,
  type VariantMap,
} from "./recipe";
export { cn, createCn, SYSTEM_VOCABULARY, type MergeVocabulary } from "./cn";
export { DEFAULT_RECIPES, type DefaultRecipes } from "./defaults";
export { FILL, LAYER, STATE, TONES, type Tone } from "./tones";
export { splitVariants, variantNames } from "./split";

/**
 * Registers the app's ui for typing. Augment it once, next to `defineUi`:
 *
 *   declare module "@omerdlw/base-framework/ui/recipes" {
 *     interface UiRegister { ui: typeof ui }
 *   }
 *
 * Then every component's variant props follow the app's recipes: a variant
 * value the app adds type-checks, one it never wrote does not.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UiRegister {}
