import { defineRecipe } from "./recipe";

const part = () => defineRecipe({});

const flag = { false: "", true: "" } as const;

const layout = { fill: "", intrinsic: "" } as const;

/**
 * The built-in component parts and their variants that `defineUi` can restyle.
 */
export const ANATOMY = {
  button: {
    root: defineRecipe({ variants: { intent: {} } }),
    bare: part(),
    busy: part(),
    busyLabel: part(),
    busySpinner: part(),
  },
  input: { field: part(), area: part() },
  switch: { track: part(), thumb: part() },
  checkbox: {
    root: part(),
    box: defineRecipe({ variants: { checked: flag } }),
    glyph: defineRecipe({ variants: { checked: flag } }),
  },
  segmented: {
    root: part(),
    segment: defineRecipe({ variants: { active: flag } }),
    pill: part(),
    chosen: part(),
    icon: part(),
    count: part(),
  },
  select: {
    root: part(),
    trigger: part(),
    value: part(),
    label: part(),
    placeholder: part(),
    chevron: part(),
    menu: part(),
    option: part(),
    highlight: part(),
    optionBody: part(),
    text: part(),
    description: part(),
    icon: part(),
    check: part(),
    empty: part(),
  },
  carousel: {
    root: part(),
    track: part(),
    slide: part(),
    arrow: defineRecipe({
      variants: { side: { left: "", right: "" }, visible: flag },
    }),
    icon: part(),
  },
  tooltip: { content: part(), label: part() },
  loader: {
    root: defineRecipe({ variants: { over: flag } }),
    label: part(),
    overlay: part(),
    dots: part(),
    dot: part(),
    spinner: part(),
    icon: part(),
  },
  skeleton: { block: part(), lines: part(), line: part(), bar: part() },
  image: {
    frame: defineRecipe({ variants: { layout, loading: flag } }),
    picture: defineRecipe({ variants: { layout } }),
    fallback: part(),
  },
  avatar: { root: part(), image: part(), initials: part() },
  highlight: { fill: part() },
} as const;

/**
 * Type of `ANATOMY`.
 */
export type Anatomy = typeof ANATOMY;
