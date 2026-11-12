import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

export interface MergeVocabulary {
  readonly theme?: Readonly<Record<string, readonly string[]>>;
  readonly classGroups?: Readonly<Record<string, readonly string[]>>;
}

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

export const cn = createCn();
