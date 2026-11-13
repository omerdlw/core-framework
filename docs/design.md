# Design — `@omerdlw/base-framework/ui`

> **Read this first if you need to:** build an interface from the framework's components (Button, Input, Select, Switch, Checkbox, SegmentedControl, Carousel, Tooltip, Image, Avatar, Loader, Skeleton, indicators), give them your product's look, add your own variants, or understand why the framework ships no styles.

---

## 1. The idea

The framework holds **no design**. No CSS file, no colour or size tokens, no motion values, no icon set. The modules (`dock`, `modal`, …) already work this way: they own mechanics and take every class and every timing from the app's theme. The components follow the same rule.

- Each component is **behaviour plus an anatomy**: the parts it renders (`select.trigger`, `select.menu`, …) and the states it sets on them (`checked`, `active`, `visible`, `loading`, …). Every part starts as an empty recipe.
- The app gives the parts their look in **one file** with `defineUi(...)`: a base, named variants, compound variants and defaults for each part (`cva`-shaped). It also gives the motion and the icons.
- The result is a plain, **server-safe object**. A Server Component calls a part (`ui.parts.button.root({ intent: "primary" })`); `<UiProvider ui={ui}>` hands it to the components.
- A one-line **module augmentation** types the components from the app's recipes: a variant the app wrote type-checks; one nobody wrote does not.

Without a ui, every component renders with no class at all and no animation. That is the contract, and a test holds it.

```
@omerdlw/base-framework/recipes   defineUi, recipes, createCn, ANATOMY   (server-safe)
@omerdlw/base-framework/ui           UiProvider + components                ("use client")
```

`design` sits beside `hooks` in the layer hierarchy: it imports `hooks`, `theme`, `kernel` and `utils`, and never imports a module. The modules render with its `Button`, `Icon`, `Loader` and `Tooltip`, so those pick up the app's look too.

---

## 2. Setup

### 2.1 The ui

```ts
// src/design/ui.ts — no "use client": Server Components import it too
import { defineUi } from "@omerdlw/base-framework/recipes";

export const ui = defineUi({
  parts: {
    button: {
      root: {
        base: "inline-flex items-center justify-center gap-2 font-medium",
        variants: {
          intent: {
            primary: "bg-primary text-on-primary",
            ghost: "bg-transparent",
          },
          size: { sm: "h-8 px-3 text-sm", md: "h-10 px-4" },
        },
        defaultVariants: { size: "md" },
      },
      busyLabel: { base: "invisible col-start-1 row-start-1" },
      busySpinner: { base: "col-start-1 row-start-1 grid place-items-center" },
    },
    // …every part you use
  },
  icons: {
    check: "lucide:check",
    chevron: "lucide:chevron-down",
    spinner: "lucide:loader",
  },
  motion: { follow: { type: "spring", stiffness: 500, damping: 40 } },
});

declare module "@omerdlw/base-framework/recipes" {
  interface UiRegister {
    ui: typeof ui;
  }
}
```

A part takes a recipe (`{ base, variants, compoundVariants, defaultVariants }`); `reset: true` drops what the anatomy declared. Your CSS (colours, type scale, utilities) lives in your app; the framework neither ships nor reads it.

### 2.2 The provider

```tsx
// app/providers.tsx ("use client")
import { TooltipProvider, UiProvider } from "@omerdlw/base-framework/ui";
import { ui } from "@/design/ui";

<UiProvider ui={ui}>
  <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
</UiProvider>;
```

A nested `UiProvider` restyles a subtree. Mount `TooltipProvider` from the library (it binds the framework's own Radix copy, which the dock's tooltips use too).

---

## 3. What the app gives

### 3.1 Parts

| Level        | Where                                             | Reach                |
| :----------- | :------------------------------------------------ | :------------------- |
| **Recipes**  | `defineUi({ parts })`                             | one part, everywhere |
| **Subtree**  | a nested `<UiProvider ui={otherUi}>`              | one part, below it   |
| **Instance** | `className` (root) and `classNames={{ part: … }}` | one element          |

A variant you add arrives as a prop the component never named; it styles the part and never reaches the DOM. A component of your own can live in the same system: `defineUi({ parts: { badge: { root: { … } } } })` and call `ui.parts.badge.root(…)`.

### 3.2 Motion

```ts
defineUi({
  motion: {
    follow: { type: "spring", stiffness: 500, damping: 40 }, // segmented pill, highlight
    menu: {
      // select menu; custom = 1 or -1 (opens down / up)
      initial: (rise) => ({ opacity: 0, y: rise * -8 }),
      animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
      exit: (rise) => ({
        opacity: 0,
        y: rise * -6,
        transition: { duration: 0.15 },
      }),
    },
    option: {
      // each option; custom = its index
      initial: { opacity: 0 },
      animate: (index) => ({ opacity: 1, transition: { delay: 0.02 * index } }),
    },
    glide: { duration: 0.8, ease: [0.5, 0, 0.1, 1] }, // carousel arrows
  },
});
```

`menu` and `option` are `motion/react` variants (`initial`, `animate`, `exit`). Leave a key out and that part does not animate: the pill and the highlight jump, the menu appears, the carousel scrolls in one step. Every value is retimed by `ThemeProvider motion`'s tempo and replaced by its `still` transition for reduced motion.

### 3.3 Icons and labels

`icons` names the Iconify glyphs the components draw: `check`, `selected`, `chevron`, `previous`, `next`, `spinner`. An icon you leave out is not drawn. Icons have no size of their own: give the part a size (`size-4 text-[length:16px]`), or pass `size` to `Icon`.

`labels` (`loading`, `placeholder`, `empty`, `previous`, `next`) are text for screen readers and empty states. They default to English so a component is never silent; override them for your language.

### 3.4 Your class names in `cn`

`cn` is `tailwind-merge`, knowing only Tailwind's own classes. Teach it your names so a later class of the same family wins:

```ts
defineUi({
  merge: {
    theme: { radius: ["card", "tile"], spacing: ["control-md"] },
    classGroups: {
      "font-size": ["type-body", "type-meta"],
      duration: ["duration-move"],
    },
  },
});
ui.cn("type-body", "type-meta"); // "type-meta"
```

`theme` extends Tailwind's scales; `classGroups` lists whole class names per group.

---

## 4. Components

Every part below starts empty. "States" are the variants the component sets itself; give them classes, or leave them blank.

| Component                                                                             | Parts (`classNames` keys)                                                                                                                                   | States                                       | Notes                                                                                                                                                                                                                                                                  |
| :------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                                                              | `root`, `bare`, `busy`, `busyLabel`, `busySpinner`                                                                                                          | —                                            | With an `intent` prop it draws `root`, without one `bare`. `loading` stacks `busyLabel` and `busySpinner` inside `busy`. Pass `href` to render a `next/link` with the same classes.                                                                                    |
| `Input`, `Textarea`                                                                   | `field`, `area`                                                                                                                                             | —                                            | `Textarea` draws `field` plus `area`.                                                                                                                                                                                                                                  |
| `Switch`                                                                              | `track`, `thumb`                                                                                                                                            | —                                            | `data-state="checked"/"unchecked"` on both; `role="switch"`, `onCheckedChange`.                                                                                                                                                                                        |
| `Checkbox`, `CheckboxIndicator`                                                       | `root`, `box`, `glyph`                                                                                                                                      | `checked` (box, glyph)                       | `pending` plays the loader.                                                                                                                                                                                                                                            |
| `SegmentedControl`                                                                    | `root`, `segment`, `pill`, `chosen`, `icon`, `count`                                                                                                        | `active` (segment)                           | Tabs with a sliding pill; `chosen` paints the active tab until the pill is measured.                                                                                                                                                                                   |
| `Select`                                                                              | `root`, `trigger`, `value`, `label`, `placeholder`, `chevron`, `menu`, `option`, `highlight`, `optionBody`, `text`, `description`, `icon`, `check`, `empty` | —                                            | Listbox: arrows, Enter/Space, Escape; flips up; anchor positioning where supported; scroll lock while open. `offset` and `collisionPadding` (px, default 0); the room left in the viewport is `--select-available-height` on the menu. `floatingProps` for the portal. |
| `Carousel`                                                                            | `root`, `track`, `slide`, `arrow`, `icon`                                                                                                                   | `side`, `visible` (arrow)                    | Touch, wheel, mouse drag; arrow glide; `onNearEnd`. `trackProps` for data hooks; inject `glide`, `renderSlide`, `ready`, `frameSelector` to drive it from your own engine.                                                                                             |
| `Tooltip`, `TooltipProvider`                                                          | `content`, `label`                                                                                                                                          | —                                            | `sideOffset` and `collisionPadding` default to Radix's; `contentProps` for data hooks, `triggerRef`. Radix copies the content's `z-index` to its portal.                                                                                                               |
| `Image`                                                                               | `frame`, `picture`, `fallback`                                                                                                                              | `layout` (frame, picture), `loading` (frame) | `loading` is true until the picture decodes (paused off screen); CORS retry; fallback.                                                                                                                                                                                 |
| `Avatar`                                                                              | `root`, `image`, `initials`                                                                                                                                 | —                                            | `size` sets width and height inline; without it the root's classes size it.                                                                                                                                                                                            |
| `Loader`, `Spinner`                                                                   | `root`, `label`, `overlay`, `dots`, `dot`, `spinner`, `icon`                                                                                                | `over` (root)                                | Three `dot`s inside `dots`; `size` sets `--loader-size` on `dots`. Over content, `label` keeps the width and `overlay` holds the dots.                                                                                                                                 |
| `SkeletonBlock`, `SkeletonLines`                                                      | `block`, `lines`, `line`, `bar`                                                                                                                             | —                                            | `SkeletonLines` draws one `bar` per width inside a `line`.                                                                                                                                                                                                             |
| `SlidingPill`, `useSlidingPill`, `SlidingHighlight`, `HighlightGroup`, `useHighlight` | `highlight.fill`                                                                                                                                            | —                                            | Positioned inline (absolute, no pointer events); the `follow` motion moves them.                                                                                                                                                                                       |
| `Icon`                                                                                | —                                                                                                                                                           | —                                            | Iconify. `size` in px, or let its class size it (`1em`).                                                                                                                                                                                                               |

Pure helpers for your own racks: `glideTarget`, `rackClip`, `readScroll`, `useDragScroll`.

---

## 5. Rules

1. **No design in the framework.** A class, a colour, a duration or an icon name in `src/` is a bug; it belongs in the app's ui or theme.
2. **Write classes literally.** Tailwind reads source files; a class built at runtime is never generated.
3. **Style in `defineUi`, not at the call site.** `className` is for layout (`w-full`, `mt-4`), not for redrawing a part on every use.
4. **One ui per app.** Derive variants of it with `defineUi({ ...ui.config, … })` for a subtree.
5. **Server Components call parts, client components render components.** `ui.parts.*` is safe anywhere; components are `"use client"`.
