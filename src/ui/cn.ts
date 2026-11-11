import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * `cn` for the design system: clsx, then tailwind-merge taught the system's
 * own vocabulary (styles/tokens.css), so `type-body` and `type-meta` are one
 * family, `h-control-md` and `h-8` are one family, and a later class replaces
 * an earlier one instead of both landing in the DOM.
 *
 * An app that adds tokens of its own (a spacing scale, a tracking) passes them
 * to `createCn` (or to `defineUi({ merge })`), so its classes merge too.
 */

/** Names an app adds to tailwind-merge, by theme key or by class group. */
export interface MergeVocabulary {
  readonly theme?: Readonly<Record<string, readonly string[]>>;
  readonly classGroups?: Readonly<Record<string, readonly string[]>>;
}

/** The framework's own token names (styles/tokens.css, styles/utilities.css). */
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

/** Utilities whose class is `<prefix>-<name>` rather than a Tailwind theme key. */
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

/** A `cn` that knows the system's vocabulary plus `vocabulary`. */
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

/** `cn` with the system's vocabulary only. */
export const cn = createCn();
