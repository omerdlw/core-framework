import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

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
): (...inputs: ClassValue[]) => string {
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
  return (...inputs) => merge(clsx(inputs));
}

/**
 * Joins class values and resolves Tailwind conflicts (default vocabulary).
 */
export const cn = createCn();
