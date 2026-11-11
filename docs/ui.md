# UI Library — `@omerdlw/base-framework/ui`

> **Read this first if you need to:** build an interface from the framework's components (Button, Input, Select, Switch, Checkbox, SegmentedControl, Carousel, Tooltip, Image, Avatar, Loader, Skeleton, indicators), restyle them for your product, add your own variants, or understand the design tokens they are drawn from.

---

## 1. The idea

The modules (`dock`, `modal`, …) own mechanics and leave every visual decision to the app. The UI library is the other half: **styled components whose every class is data the app can change.**

- Each component part has a **recipe**: a base, named variants, compound variants and defaults (`cva`-shaped), written against **colour roles, the control ladder and the type scale**, never paint.
- The app styles the library in **one file** with `defineUi(...)`: it appends to a recipe, adds variant values or whole variants, or resets a part and writes it from scratch.
- The result is a plain, **server-safe object**. A Server Component calls a part (`ui.parts.button.root({ intent: "primary" })`); `<UiProvider ui={ui}>` hands it to the components.
- A one-line **module augmentation** types the components from the app's recipes: a value the app added type-checks; one nobody wrote does not.

```
@omerdlw/base-framework/styles.css     tokens · palette · time · utilities · interaction · effects
@omerdlw/base-framework/ui/recipes     defineUi, recipes, createCn, TONES/STATE/FILL/LAYER   (server-safe)
@omerdlw/base-framework/ui             UiProvider + components                                ("use client")
```

`ui` sits beside `atoms` in the layer hierarchy: it imports `atoms`, `hooks`, `theme`, `tokens` and `utils`, and never a module.

---

## 2. Setup

### 2.1 Stylesheet

```css
/* app/globals.css */
@import "tailwindcss";
@import "@omerdlw/base-framework/styles.css";
@import "./palette.css"; /* optional: your roles and tokens */
```

The stylesheet carries its own `@source`, so Tailwind finds the classes the recipes name. It defines:

| File | What |
| :--- | :--- |
| `tokens.css` | The vocabulary: `type-*` sizes, `rounded-{mark,thumb,inset,tile,card,panel,sheet,shell}`, the control ladder `h-control-{xs,sm,chrome,md,lg}` (24 · 32 · 36 · 40 · 48), named eases, and **colour roles**. Tailwind's palette is switched off: every colour is a role. |
| `palette.css` | Dark and light values for every role (`data-theme="light"` on `<html>`; `.on-photo` keeps a subtree dark). Zero specificity: your `:root { … }` wins. |
| `time.css` | The time ladder `--step-n6 … --step-6` (`0.5s × φⁿ`, scaled by `--tempo`) and `--curve-*`. Zero specificity. |
| `utilities.css` | `type-*`, `duration-{flick,touch,leave,light,reveal,move,settle,linger}`, `center`, `scrollbar-none`. |
| `interaction.css` | The interaction contract inside a scene (`.ui-scene`, `.ui-motion`): hover = focus-visible, one system focus outline, press, `ui-iris`, `ui-fade`, `ui-glyph`. Opt out of press with `.ui-still` / `[data-still]`, out of the outline with `[data-own-focus]`. |
| `effects.css` | `ui-sheen`, `ui-develop`, `ui-turn`, `ui-skeleton(-soft)`, `ui-pulse`, `ui-dots`, `ui-tooltip`. |

**Colour roles:** `page`, `ink`, `ink-{lead,body,muted,faint}`, `fill`, `fill-{hover,active}`, `edge`, `edge-{hover,focus}`, `rule`, `line`, `plate`, `glass`, `veil`, `dim`, `primary`, `primary-hover`, `on-primary`, `on-accent`, `accent`, `danger`. Give each a value in your palette (`--ink-rgb`, `--fill`, `--accent`, …) or rebind the Tailwind key itself in `@theme inline` (e.g. `--color-accent: rgb(var(--grade))` to read a value set on an element).

### 2.2 The ui and its provider

```ts
// src/design/ui.ts — no "use client": Server Components import it too
import { defineUi } from "@omerdlw/base-framework/ui/recipes";

export const ui = defineUi({
  parts: {
    button: {
      root: {
        variants: {
          intent: { brand: "bg-brand text-on-primary hover:bg-brand/90" },
          elevated: { true: "shadow-xl" },
        },
      },
    },
  },
});

declare module "@omerdlw/base-framework/ui/recipes" {
  interface UiRegister {
    ui: typeof ui;
  }
}
```

```tsx
// app/providers.tsx ("use client")
import { TooltipProvider, UiProvider } from "@omerdlw/base-framework/ui";
import { ui } from "@/design/ui";

<UiProvider ui={ui}>
  <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
</UiProvider>;
```

Without a provider the components use the library's defaults. A nested `UiProvider` restyles a subtree. Mount `TooltipProvider` from the library (it binds the framework's own Radix copy, which the dock's tooltips use too).

---

## 3. Customizing — four levels

| Level | Where | Reach |
| :--- | :--- | :--- |
| **Tokens** | your CSS (`:root { --ink-rgb: …; --radius-card: 14px }`) | every component, every module slot that names the role |
| **Recipes** | `defineUi({ parts })` | one part, everywhere |
| **Subtree** | a nested `<UiProvider ui={otherUi}>` | one part, below it |
| **Instance** | `className` (root) and `classNames={{ part: … }}` | one element |

### 3.1 Recipe overrides

```ts
defineUi({
  parts: {
    // append to the base and to one variant value; later classes of the same
    // family win (tailwind-merge, taught the system's vocabulary)
    input: { field: { base: "tracking-tight", variants: { shape: { card: "rounded-tile" } } } },
    // a new value, a new variant, a compound, a new default
    button: {
      root: {
        variants: { intent: { brand: "…" }, elevated: { true: "shadow-xl" } },
        compoundVariants: [{ intent: "brand", elevated: true, class: "shadow-brand/40" }],
        defaultVariants: { shape: "pill" },
      },
    },
    // drop the default and write the part yourself
    switch: { thumb: { reset: true, base: "block size-4 rounded-full bg-ink", variants: { size: { sm: "", md: "" } } } },
    // a component of your own, styled through the same system
    badge: { root: { base: "rounded-full px-2 type-label", variants: { tone: { info: "bg-fill" } } } },
  },
});
```

A variant you add arrives as a prop the component never named; it styles the part and never reaches the DOM.

### 3.2 Motion, icons, labels

```ts
defineUi({
  motion: {
    follow: { type: "spring", stiffness: 500, damping: 40 }, // segmented pill, highlight
    menu: { enter: { duration: 0.3, ease: [0.2, 0, 0, 1] } }, // select menu
    option: { duration: 0.2 },                                 // each option
    glide: { duration: 0.8 },                                  // carousel arrows
    timings: { stagger: 0.03 }, staggerLimit: 5,
  },
  icons: { check: "lucide:check", chevron: "lucide:chevron-down", spinner: "lucide:loader" },
  labels: { placeholder: "Seçin…", empty: "Seçenek yok", previous: "Geri", next: "İleri", loading: "Yükleniyor" },
});
```

Motion is timing only; shapes (how far a menu travels) stay in the component. Every value is retimed by `ThemeProvider motion`'s tempo and collapsed for reduced motion.

### 3.3 Your token names

If your CSS adds tokens, teach `cn` so they merge:

```ts
defineUi({ merge: { theme: { spacing: ["fib-1", "fib-2"], tracking: ["label"] }, classGroups: { duration: ["ripple"] } } });
ui.cn("p-fib-2", "p-4"); // "p-4"
```

---

## 4. Components

| Component | Parts (`classNames` keys) | Variants | Notes |
| :--- | :--- | :--- | :--- |
| `Button` | `root`, `bare`, `busy` | `intent` neutral · outline · chosen · primary · danger · armed · glass · ghost; `size` xs · sm · chrome · md · lg; `shape` card · pill · thumb; `icon`; `width` auto · full · fill | No `intent` → bare (no surface). `loading` keeps the label width. |
| `Input`, `Textarea` | `field` | `appearance` field · bare; `size` sm · md · lg (`area` for Textarea); `shape` card · pill | `Input` defaults to `md`; `ui.parts.input.field()` alone sizes nothing. |
| `Switch` | `track`, `thumb` | `size` sm · md | `role="switch"`, `onCheckedChange`. |
| `Checkbox`, `CheckboxIndicator` | `root`, `box`, `glyph` | `size` sm · md; `reveal`; `checked` | `pending` plays the loader. The indicator alone suits a row that is the checkbox. |
| `SegmentedControl` | `root`, `segment`, `pill`, `chosen`, `count` | `size` sm · md; `shape` pill · card; `width` auto · fill | Tabs with a sliding pill. |
| `Select` | `root`, `trigger`, `value`, `placeholder`, `chevron`, `menu`, `option`, `highlight`, `optionBody`, `description`, `icon`, `check`, `empty` | `size` sm · md; `shape` card · pill | Listbox: arrows, Enter/Space, Escape; flips up; anchor positioning where supported; scroll lock while open. `floatingProps` for the portal. |
| `Carousel` | `root`, `track`, `slide`, `arrow` | arrow: `side`, `visible` | Touch, wheel, mouse drag; arrow glide; `onNearEnd`. Inject `glide`, `renderSlide`, `ready`, `frameSelector` to drive it from your own engine. |
| `Tooltip`, `TooltipProvider` | `content`, `label` | — | `contentProps` for data hooks, `triggerRef`. |
| `Image` | `frame`, `picture`, `fallback` | `layout` fill · intrinsic; `fit` cover · contain | Skeleton while loading (paused off screen), fade on decode, CORS retry, fallback. |
| `Avatar` | `root`, `image`, `initials` | — | Initials when there is no picture. |
| `Loader`, `Spinner` | `root`, `spinner` | `over` | Dots inline or over content; a spinning glyph. |
| `SkeletonBlock`, `SkeletonLines` | `block`, `line` | `tone` block · soft | |
| `SlidingPill`, `useSlidingPill`, `SlidingHighlight`, `HighlightGroup`, `useHighlight` | `highlight.fill` | — | The `follow` motion. |
| `Icon` | — | — | Iconify, square, sized in px. |

Pure helpers for your own racks: `glideTarget`, `rackClip`, `readScroll`, `useDragScroll`. Tones for your own elements: `TONES`, `STATE`, `FILL`, `LAYER`.

---

## 5. Rules

1. **Name roles, never paint.** A recipe says `bg-fill text-ink-body`, not `bg-white/5 text-zinc-300`.
2. **Write classes literally.** Tailwind reads source files; a class built at runtime is never generated.
3. **Style in `defineUi`, not at the call site.** `className` is for layout (`w-full`, `mt-4`), not for redrawing a part on every use.
4. **One ui per app.** Derive variants of it with `defineUi({ ...ui.config, … })` for a subtree.
5. **Server Components call parts, client components render components.** `ui.parts.*` is safe anywhere; components are `"use client"`.
