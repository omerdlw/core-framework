import { defineRecipe } from "./recipe";
import { FILL, LAYER, STATE, TONES } from "./tones";

const buttonRoot = defineRecipe({
  base: [
    "center relative inline-flex cursor-pointer items-center justify-center font-medium select-none outline-none",
    STATE.disabled,
    STATE.busy,
  ],
  variants: {
    intent: TONES,
    size: {
      xs: "h-control-xs gap-1 px-2.5 type-label",
      sm: "h-control-sm gap-1.5 px-3.5 type-meta",
      chrome: "h-control-chrome gap-2 px-4 type-control",
      md: "h-control-md gap-2 px-4 type-control",
      lg: "h-control-lg gap-2.5 px-5 type-body",
    },
    shape: {
      card: "rounded-card",
      pill: "rounded-full",
      thumb: "rounded-thumb",
    },
    icon: { false: "", true: "shrink-0 px-0" },
    width: { auto: "", full: "w-full", fill: "min-w-0 flex-1" },
  },
  compoundVariants: [
    { icon: true, size: "xs", class: "size-control-xs" },
    { icon: true, size: "sm", class: "size-control-sm" },
    { icon: true, size: "chrome", class: "size-control-chrome" },
    { icon: true, size: "md", class: "size-control-md" },
    { icon: true, size: "lg", class: "size-control-lg" },
  ],
  defaultVariants: {
    icon: false,
    intent: "neutral",
    shape: "card",
    size: "md",
    width: "auto",
  },
});

const buttonBare = defineRecipe({
  base: "disabled:cursor-not-allowed disabled:opacity-50 disabled:aria-busy:cursor-wait disabled:aria-busy:opacity-100",
});

const buttonBusy = defineRecipe({ base: "inline-grid place-items-center" });

const inputField = defineRecipe({
  base: "w-full min-w-0 outline-none disabled:cursor-not-allowed disabled:opacity-50",
  variants: {
    appearance: {
      field:
        "bg-fill text-ink ring-1 ring-edge ring-inset placeholder:text-ink-muted hover:bg-fill-hover focus:bg-fill-hover focus:ring-edge-focus",
      bare: "",
    },
    size: {
      sm: "h-control-sm px-3 type-meta",
      md: "h-control-md px-4 type-body",
      lg: "h-control-lg px-5 type-body",
      area: "block min-h-control-lg px-4 py-3 type-body leading-6",
    },
    shape: { card: "rounded-card", pill: "rounded-full" },
  },
  defaultVariants: { appearance: "field", shape: "card" },
});

const switchTrack = defineRecipe({
  base: [
    "group/switch ui-still relative inline-flex shrink-0 cursor-pointer items-center rounded-full bg-fill-hover p-0.5 ring-1 ring-edge ring-inset",
    "transition-[background-color,box-shadow,outline-color,outline-offset] duration-reveal ease-out-cream",
    "hover:bg-fill-active hover:ring-edge-hover focus-visible:bg-fill-active focus-visible:ring-edge-focus",
    "data-[state=checked]:bg-primary data-[state=checked]:ring-primary data-[state=checked]:hover:bg-primary-hover data-[state=checked]:focus-visible:bg-primary-hover",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ],
  variants: { size: { sm: "h-5 w-8", md: "h-6 w-10" } },
  defaultVariants: { size: "md" },
});

const switchThumb = defineRecipe({
  base: [
    "pointer-events-none block translate-x-0 rounded-full bg-ink-body transition-[translate,width,background-color] duration-reveal ease-out-cream",
    "group-hover/switch:bg-ink-lead group-focus-visible/switch:bg-ink-lead group-has-focus-visible/switch:bg-ink-lead",
    "data-[state=checked]:bg-on-primary",
  ],
  variants: {
    size: {
      sm: "h-4 w-4 group-active/switch:w-5 data-[state=checked]:translate-x-3 group-active/switch:data-[state=checked]:translate-x-2",
      md: "h-5 w-5 group-active/switch:w-6 data-[state=checked]:translate-x-4 group-active/switch:data-[state=checked]:translate-x-3",
    },
  },
  defaultVariants: { size: "md" },
});

const checkboxRoot = defineRecipe({
  base: "group inline-flex cursor-pointer items-center gap-2.5 type-body text-ink-body select-none hover:text-ink focus-visible:text-ink disabled:cursor-not-allowed disabled:opacity-50",
});

const checkboxBox = defineRecipe({
  base: "center relative z-10 shrink-0 rounded-full ring-1 ring-inset",
  variants: {
    checked: {
      true: "bg-accent text-on-accent ring-accent",
      false:
        "text-transparent ring-edge-hover group-hover:ring-edge-focus group-focus-visible:ring-edge-focus group-has-focus-visible:ring-edge-focus",
    },
    reveal: { false: "", true: "" },
    size: { sm: "size-5", md: "size-6" },
  },
  compoundVariants: [
    {
      checked: false,
      reveal: true,
      class:
        "group-hover:text-ink-faint group-focus-visible:text-ink-faint group-has-focus-visible:text-ink-faint",
    },
  ],
  defaultVariants: { checked: false, reveal: false, size: "md" },
});

const checkboxGlyph = defineRecipe({
  base: "ui-glyph center",
  variants: {
    reveal: { false: "", true: "" },
    checked: { false: "", true: "" },
  },
  compoundVariants: [
    { reveal: true, checked: true, class: "scale-100" },
    { reveal: true, checked: false, class: "scale-75 group-hover:scale-90" },
  ],
});

const segmentedRoot = defineRecipe({
  base: "relative max-w-full items-stretch gap-0.5 overflow-x-auto bg-fill p-0.5 ring-1 ring-edge ring-inset select-none scrollbar-none",
  variants: {
    size: { sm: "h-control-sm", md: "h-control-md" },
    shape: { pill: "rounded-full", card: "rounded-card" },
    width: { auto: "inline-flex w-fit", fill: "flex w-full" },
  },
  defaultVariants: { shape: "pill", size: "sm", width: "auto" },
});

const segmentedSegment = defineRecipe({
  base: "ui-fade relative inline-flex min-w-fit cursor-pointer items-center justify-center gap-1.5 font-medium whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-edge-focus focus-visible:ring-inset",
  variants: {
    active: {
      true: "text-ink",
      false: "text-ink-body hover:text-ink focus-visible:text-ink",
    },
    size: { sm: "px-3.5 type-meta", md: "px-4 type-control" },
    shape: { pill: "rounded-full", card: "rounded-tile" },
    width: { auto: "", fill: "flex-1" },
  },
  defaultVariants: {
    active: false,
    shape: "pill",
    size: "sm",
    width: "auto",
  },
});

const segmentedPill = defineRecipe({
  base: "inset-y-0.5 bg-accent/15",
  variants: { shape: { pill: "rounded-full", card: "rounded-tile" } },
  defaultVariants: { shape: "pill" },
});

const segmentedChosen = defineRecipe({ base: "bg-accent/15" });

const segmentedCount = defineRecipe({ base: "-ml-0.5 tabular-nums" });

const selectRoot = defineRecipe({
  base: "relative inline-flex w-full flex-col gap-1.5",
});

const selectTrigger = defineRecipe({
  base: [
    "ui-fade group flex w-full items-center justify-between gap-2 bg-fill text-left text-ink ring-1 ring-edge ring-inset",
    "hover:bg-fill-hover hover:ring-edge-hover focus-visible:bg-fill-hover focus-visible:ring-edge-focus aria-expanded:bg-fill-hover aria-expanded:ring-edge-focus",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ],
  variants: {
    size: {
      sm: "h-control-sm px-3 type-meta",
      md: "h-control-md px-3.5 type-body",
    },
    shape: { card: "rounded-card", pill: "rounded-full" },
  },
  defaultVariants: { shape: "card", size: "md" },
});

const selectValue = defineRecipe({
  base: "flex min-w-0 items-center gap-2 truncate",
});

const selectPlaceholder = defineRecipe({ base: "truncate text-ink-muted" });

const selectChevron = defineRecipe({
  base: "ui-turn shrink-0 text-ink-muted group-aria-expanded:rotate-180 group-aria-expanded:text-ink",
});

const selectMenu = defineRecipe({
  base: [
    "ui-motion absolute top-full left-0 mt-1.5 max-h-64 w-full overflow-y-auto overscroll-contain",
    LAYER.shell,
  ],
  variants: {
    size: { sm: "p-1", md: "p-1.5" },
    shape: { card: "rounded-card", pill: "" },
  },
  compoundVariants: [
    { shape: "pill", size: "sm", class: "rounded-[18px]" },
    { shape: "pill", size: "md", class: "rounded-sheet" },
  ],
  defaultVariants: { shape: "card", size: "md" },
});

const selectOption = defineRecipe({
  base: [
    "relative isolate flex cursor-pointer items-center justify-between gap-2.5 text-ink-body select-none",
    "data-[highlighted]:text-ink aria-selected:font-medium aria-selected:text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
  ],
  variants: {
    size: {
      sm: "px-2.5 py-1.5 type-meta",
      md: "px-3 py-2 type-body",
    },
    shape: { card: "", pill: "" },
  },
  compoundVariants: [
    { shape: "card", size: "sm", class: "rounded-tile" },
    { shape: "card", size: "md", class: "rounded-inset" },
    { shape: "pill", size: "sm", class: "rounded-full" },
    { shape: "pill", size: "md", class: "rounded-full" },
  ],
  defaultVariants: { shape: "card", size: "md" },
});

const selectHighlight = defineRecipe({
  base: "rounded-[inherit] bg-fill-hover",
});

const selectOptionBody = defineRecipe({
  base: "relative z-10 flex min-w-0 items-center gap-2.5",
});

const selectDescription = defineRecipe({
  base: "truncate type-meta text-ink-muted",
});

const selectIcon = defineRecipe({ base: "ui-glyph shrink-0 text-ink-body" });

const selectCheck = defineRecipe({ base: "relative z-10 shrink-0 text-ink" });

const selectEmpty = defineRecipe({
  base: "px-3 py-2 text-center type-meta text-ink-muted",
});

const carouselRoot = defineRecipe({ base: "relative w-full" });

const carouselTrack = defineRecipe({
  base: "relative flex cursor-grab touch-pan-y gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain select-none data-[dragging=true]:cursor-grabbing",
});

const carouselSlide = defineRecipe({ base: "shrink-0" });

const carouselArrow = defineRecipe({
  base: [
    "center absolute top-1/2 z-10 size-control-chrome -translate-y-1/2 cursor-pointer transition-[opacity,scale,background-color] duration-move ease-out-expo sm:size-control-md",
    "rounded-full bg-veil text-ink ring-1 ring-edge-hover ring-inset backdrop-saturate-150 hover:bg-glass focus-visible:bg-glass",
  ],
  variants: {
    side: { left: "left-2 sm:left-3", right: "right-2 sm:right-3" },
    visible: {
      true: "scale-100 opacity-100",
      false: "pointer-events-none scale-75 opacity-0",
    },
  },
  defaultVariants: { visible: true },
});

const tooltipContent = defineRecipe({
  base: [
    "ui-tooltip relative max-w-[min(16rem,calc(100vw-1.5rem))] rounded-card px-3 pt-1.5 pb-[7px] type-meta font-medium text-balance select-none",
    LAYER.tip,
  ],
});

const tooltipLabel = defineRecipe({ base: "ui-tooltip-label block" });

const loaderRoot = defineRecipe({
  base: "pointer-events-none shrink-0 leading-none select-none",
  variants: {
    over: {
      false: "inline-flex h-[1em] items-center justify-center",
      true: "inline-grid place-items-center",
    },
  },
  defaultVariants: { over: false },
});

const loaderSpinner = defineRecipe({
  base: "inline-flex animate-spin items-center justify-center align-middle leading-none",
});

const skeletonBlock = defineRecipe({
  base: "",
  variants: { tone: { block: "ui-skeleton", soft: "ui-skeleton-soft" } },
  defaultVariants: { tone: "block" },
});

const skeletonLine = defineRecipe({ base: "flex h-[1lh] items-center" });

const imageFrame = defineRecipe({
  base: "relative overflow-hidden select-none",
  variants: {
    layout: {
      fill: "h-full w-full bg-fill",
      intrinsic: "inline-flex max-w-full",
    },
  },
  defaultVariants: { layout: "fill" },
});

const imagePicture = defineRecipe({
  base: "opacity-0 data-[state=loaded]:opacity-100",
  variants: {
    layout: {
      fill: "h-full w-full data-[fill]:absolute data-[fill]:inset-0 data-[fill]:select-none",
      intrinsic: "block max-w-full",
    },
    fit: { cover: "object-cover", contain: "object-contain" },
  },
  defaultVariants: { fit: "cover", layout: "fill" },
});

const imageFallback = defineRecipe({
  base: "relative h-full w-full overflow-hidden select-none",
});

const avatarRoot = defineRecipe({
  base: "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-fill-hover text-ink-body select-none",
});

const avatarImage = defineRecipe({ base: "h-full w-full object-cover" });

const avatarInitials = defineRecipe({
  base: "flex h-full w-full items-center justify-center type-meta font-medium uppercase",
});

const highlightFill = defineRecipe({ base: "-z-10 rounded-card bg-fill" });

export const DEFAULT_RECIPES = {
  button: { root: buttonRoot, bare: buttonBare, busy: buttonBusy },
  input: { field: inputField },
  switch: { track: switchTrack, thumb: switchThumb },
  checkbox: { root: checkboxRoot, box: checkboxBox, glyph: checkboxGlyph },
  segmented: {
    root: segmentedRoot,
    segment: segmentedSegment,
    pill: segmentedPill,
    chosen: segmentedChosen,
    count: segmentedCount,
  },
  select: {
    root: selectRoot,
    trigger: selectTrigger,
    value: selectValue,
    placeholder: selectPlaceholder,
    chevron: selectChevron,
    menu: selectMenu,
    option: selectOption,
    highlight: selectHighlight,
    optionBody: selectOptionBody,
    description: selectDescription,
    icon: selectIcon,
    check: selectCheck,
    empty: selectEmpty,
  },
  carousel: {
    root: carouselRoot,
    track: carouselTrack,
    slide: carouselSlide,
    arrow: carouselArrow,
  },
  tooltip: { content: tooltipContent, label: tooltipLabel },
  loader: { root: loaderRoot, spinner: loaderSpinner },
  skeleton: { block: skeletonBlock, line: skeletonLine },
  image: { frame: imageFrame, picture: imagePicture, fallback: imageFallback },
  avatar: { root: avatarRoot, image: avatarImage, initials: avatarInitials },
  highlight: { fill: highlightFill },
} as const;

export type DefaultRecipes = typeof DEFAULT_RECIPES;

export { FILL, LAYER, STATE, TONES };
