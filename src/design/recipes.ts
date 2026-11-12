export {
  DEFAULT_LABELS,
  defaultUi,
  defineUi,
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
  type UiVariants,
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
export { cn, createCn, type MergeVocabulary } from "./cn";
export { ANATOMY, type Anatomy } from "./anatomy";
export { splitVariants, variantNames } from "./split";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UiRegister {}
