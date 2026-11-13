import { extendTailwindMerge } from "tailwind-merge";

import { type Classes, joinClasses } from "./recipe";

/**
 * Extra Tailwind theme values and class groups that `cn` should merge correctly.
 */
export interface MergeVocabulary {
  readonly theme?: Readonly<Record<string, readonly string[]>>;
  readonly classGroups?: Readonly<Record<string, readonly string[]>>;
}

/**
 * Creates a class-name joiner that also resolves Tailwind conflicts using the given vocabulary.
 */
export function createCn(
  vocabulary: MergeVocabulary = {},
): (...inputs: Classes[]) => string {
  const merge = extendTailwindMerge({
    extend: {
      theme: vocabulary.theme ?? {},
      classGroups: Object.fromEntries(
        Object.entries(vocabulary.classGroups ?? {}).map(([group, names]) => [
          group,
          [...names],
        ]),
      ),
    },
  });
  return (...inputs) => merge(joinClasses(...inputs));
}

/**
 * Joins class values and resolves Tailwind conflicts (default vocabulary).
 */
export const cn = createCn();
