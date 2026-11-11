import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

export interface MergeVocabulary {
  readonly theme?: Readonly<Record<string, readonly string[]>>;
  readonly classGroups?: Readonly<Record<string, readonly string[]>>;
}

export const SYSTEM_VOCABULARY = {
  theme: {
    ease: [
      "out-expo",
      "out-quart",
      "out-quint",
      "in-out-cubic",
      "in-cubic",
      "out-cream",
      "phosphor",
      "fade",
    ],
    spacing: [
      "control-xs",
      "control-sm",
      "control-chrome",
      "control-md",
      "control-lg",
    ],
    radius: [
      "mark",
      "thumb",
      "inset",
      "tile",
      "card",
      "panel",
      "sheet",
      "shell",
    ],
  },
  classGroups: {
    "font-size": [
      "micro",
      "label",
      "meta",
      "control",
      "body",
      "copy",
      "base",
      "prose",
      "prose-wide",
      "title",
      "heading",
      "display-xs",
      "display-sm",
      "display-md",
      "display-lg",
      "display-xl",
      "display-2xl",
    ],
    duration: [
      "flick",
      "touch",
      "leave",
      "light",
      "reveal",
      "move",
      "settle",
      "linger",
    ],
  },
} as const satisfies MergeVocabulary;

const GROUP_PREFIX: Readonly<Record<string, string>> = {
  "font-size": "type",
  duration: "duration",
};

function joinVocabulary(
  a: MergeVocabulary,
  b: MergeVocabulary = {},
): Required<MergeVocabulary> {
  const join = (
    left: Readonly<Record<string, readonly string[]>> = {},
    right: Readonly<Record<string, readonly string[]>> = {},
  ) => {
    const out: Record<string, string[]> = {};
    for (const [name, values] of [
      ...Object.entries(left),
      ...Object.entries(right),
    ]) {
      out[name] = [...new Set([...(out[name] ?? []), ...values])];
    }
    return out;
  };
  return {
    theme: join(a.theme, b.theme),
    classGroups: join(a.classGroups, b.classGroups),
  };
}

export function createCn(
  vocabulary?: MergeVocabulary,
): (...inputs: ClassValue[]) => string {
  const { theme, classGroups } = joinVocabulary(SYSTEM_VOCABULARY, vocabulary);
  const merge = extendTailwindMerge({
    extend: {
      theme: theme as Record<string, string[]>,
      classGroups: Object.fromEntries(
        Object.entries(classGroups).map(([group, names]) => [
          group,
          [{ [GROUP_PREFIX[group] ?? group]: [...names] }],
        ]),
      ),
    },
  });
  return (...inputs) => merge(clsx(inputs));
}

export const cn = createCn();
