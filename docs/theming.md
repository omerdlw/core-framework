# Theming System Guide — `@omerdlw/base-framework/theme`

> **Read this first if you need to:** customize the visual design or the animation of any first-party module (`dock`, `modal`, `notification`, etc.), supply custom Tailwind styles, set your app's motion tempo, or understand the theme slot and motion contracts.

---

## 1. Philosophy: Logic Decoupled from Aesthetics

`@omerdlw/base-framework` enforces a strict rule: **Modules own interaction mechanics, accessibility, and state machines; consumer applications own visual design.**

Modules ship with **zero hardcoded visual Tailwind colors or aesthetic choices**. Instead, each module declares a typed **Theme Spec** defining required "slots" (e.g. `card`, `backdrop`, `header`, `item`).

The same holds for **animation**. Modules that animate (`dock`, `modal`, `notification`, `context-menu`, `background`) ship no durations, curves, springs or travel distances. Their spec also declares a typed **motion contract**, and your theme file supplies it next to `slots` (§5). The module keeps only the mechanics: which phase plays when, what comes from layout, and accessibility.

If a required theme is not provided to `<ThemeProvider>`, `useTheme()` throws an informative error at mount time:
```
Theme "dock" is missing. Add its theme configuration to your ThemeProvider.
```

---

## 2. The Theme API

Import the theming primitives from `@omerdlw/base-framework/theme`:

```ts
import {
  defineThemeSpec,
  defineTheme,
  ThemeProvider,
  useTheme,
  type ThemeSpec,
  type ThemeConfig,
  type ThemeEntry,
} from "@omerdlw/base-framework/theme";
```

### 2.1 `defineThemeSpec<Slots, Motion?>(id)`
Used by module authors to define the contract:
```ts
export type DockThemeSlot = "card" | "header" | "title" | "description" | "icon" | "surface";
export const dockTheme = defineThemeSpec<DockThemeSlot, DockMotion>("dock");
```
The second type parameter is the module's motion contract. Leave it out for a module that doesn't animate (`ambient`, `controls`, `loading`, `error`).

### 2.2 `defineTheme(spec, { slots, styles?, motion })`
Used by application developers to implement the styling contract. TypeScript enforces that **every required slot** is provided, and that `motion` is given exactly when the spec declares a motion contract (§5):
```ts
export const dockThemeConfig = defineTheme(dockTheme, {
  slots: {
    card: "rounded-[28px] bg-neutral-900/80 backdrop-blur-xl border border-white/10 shadow-2xl p-4",
    header: "flex items-center gap-3",
    title: "text-sm font-medium text-white",
    description: "text-xs text-white/50",
    icon: "text-white/80",
    surface: "rounded-3xl bg-neutral-900 border border-white/10 p-6",
  },
  styles: {
    // Optional inline CSS styles (e.g. tokenized Z-Index)
    card: { zIndex: 100 },
  },
});
```

### 2.3 `ThemeProvider({ themes, motion?, children })`
Wraps your application or `CoreProvider` to supply the theme map and your motion tokens (§5.1):
```tsx
<ThemeProvider themes={[dockThemeConfig, modalThemeConfig, notificationThemeConfig]} motion={appMotion}>
  <CoreProvider modules={modules}>
    {children}
  </CoreProvider>
</ThemeProvider>
```

### 2.4 `useTheme(spec)`
Consumed internally by module overlays to read the active slots:
```tsx
const { slots, styles } = useTheme(dockTheme);
return <div className={slots.card} style={styles.card} />;
```

---

## 3. Module Theme Slot Reference

Below is the complete reference of theme specs exported by the 9 first-party modules:

| Module | Spec Export | Import Path | Primary Slots |
| :--- | :--- | :--- | :--- |
| **Dock** | `dockTheme` | `@omerdlw/base-framework/modules/dock` | `card`, `header`, `title`, `description`, `icon`, `surface`, `status` |
| **Modal** | `modalTheme` | `@omerdlw/base-framework/modules/modal` | `backdrop`, `dialog`, `header`, `title`, `body`, `footer`, `close` |
| **Notification** | `notificationTheme` | `@omerdlw/base-framework/modules/notification` | `viewport`, `toast`, `title`, `description`, `icon`, `action`, `close` |
| **Ambient** | `ambientTheme` | `@omerdlw/base-framework/modules/ambient` | `container`, `canvas` |
| **Background** | `backgroundTheme` | `@omerdlw/base-framework/modules/background` | `layer`, `overlay`, `fades` |
| **Controls** | `controlsTheme` | `@omerdlw/base-framework/modules/controls` | `rail`, `button`, `icon` |
| **Loading** | `loadingTheme` | `@omerdlw/base-framework/modules/loading` | `overlay`, `spinner`, `message` |
| **Context Menu** | `contextMenuTheme` | `@omerdlw/base-framework/modules/context-menu` | `menu`, `item`, `separator`, `label`, `shortcut` |
| **Error Boundary** | `errorTheme` | `@omerdlw/base-framework/error` | `boundary`, `card`, `title`, `message`, `retryButton` |

---

## 4. Complete Starter Theme Configuration

Create a theme definitions file in your project (e.g. `src/config/themes.ts`):

```ts
import { defineTheme } from "@omerdlw/base-framework/theme";
import { dockTheme } from "@omerdlw/base-framework/modules/dock";
import { modalTheme } from "@omerdlw/base-framework/modules/modal";
import { notificationTheme } from "@omerdlw/base-framework/modules/notification";
import { loadingTheme } from "@omerdlw/base-framework/modules/loading";
import { errorTheme } from "@omerdlw/base-framework/error";

export const appThemes = [
  defineTheme(dockTheme, {
    slots: {
      card: "rounded-[24px] bg-neutral-900/90 backdrop-blur-2xl border border-white/10 shadow-2xl p-4 text-white",
      header: "flex items-center gap-3",
      title: "text-sm font-semibold tracking-tight",
      description: "text-xs text-white/50",
      icon: "text-white/80",
      surface: "rounded-3xl bg-neutral-900/95 border border-white/10 p-6 backdrop-blur-3xl",
      status: "rounded-xl bg-white/5 px-3 py-1.5 text-xs text-white/70",
    },
  }),

  defineTheme(modalTheme, {
    slots: {
      backdrop: "fixed inset-0 bg-black/60 backdrop-blur-sm",
      dialog: "rounded-2xl bg-neutral-900 border border-white/10 shadow-2xl p-6 text-white max-w-lg w-full",
      header: "mb-4",
      title: "text-lg font-bold",
      body: "text-sm text-white/80",
      footer: "mt-6 flex justify-end gap-3",
      close: "size-8 center rounded-full hover:bg-white/10 text-white/60 hover:text-white",
    },
  }),

  defineTheme(notificationTheme, {
    slots: {
      viewport: "fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none",
      toast: "pointer-events-auto flex items-center gap-3 rounded-xl bg-neutral-900 border border-white/10 shadow-xl px-4 py-3 text-sm text-white",
      title: "font-medium text-white",
      description: "text-xs text-white/60",
      icon: "shrink-0",
      action: "text-xs font-semibold text-sky-400 hover:text-sky-300",
      close: "text-white/40 hover:text-white",
    },
  }),

  defineTheme(loadingTheme, {
    slots: {
      overlay: "center fixed inset-0 h-screen w-screen bg-black/40 backdrop-blur-xs",
      spinner: "animate-spin text-white/80",
      message: "text-xs font-medium text-white/60 mt-3",
    },
  }),

  defineTheme(errorTheme, {
    slots: {
      boundary: "center min-h-[300px] w-full p-6",
      card: "rounded-2xl bg-red-950/20 border border-red-500/20 p-6 max-w-md text-center",
      title: "text-base font-semibold text-red-400",
      message: "text-xs text-red-200/70 mt-2",
      retryButton: "mt-4 inline-flex h-8 items-center px-3 rounded-lg bg-red-500/20 text-red-300 text-xs font-medium hover:bg-red-500/30",
    },
  }),
];
```

Modules that animate also need their `motion` (§5): start from the framework's `templates/motion/` and add `motion: dockMotion` and so on next to each `slots`.

Then in `src/app/providers.tsx`:

```tsx
"use client";

import { ThemeProvider } from "@omerdlw/base-framework/theme";
import { CoreProvider } from "@omerdlw/base-framework/provider";
import { appThemes } from "@/config/themes";
import { motion } from "@/config/theme/motion/tokens";
import { modules } from "@/config/modules";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider themes={appThemes} motion={motion}>
      <CoreProvider modules={modules}>{children}</CoreProvider>
    </ThemeProvider>
  );
}
```

---

## 5. Motion: Your App Owns Every Animation

Animation is part of your design, so it lives in your theme files like your slots do. The framework applies two things to whatever you write: your **tempo** and your **reduced-motion policy**.

### 5.1 `defineMotion({ tempo?, reducedMotion?, durations?, easings?, springs? })`

```ts
// src/config/theme/motion/tokens.ts
import { defineMotion } from "@omerdlw/base-framework/tokens";

export const motion = defineMotion({
  tempo: 1, // stretches everything a module animates
  reducedMotion: "user", // "user" (OS setting) | "always" | "never"
  durations: { fast: 0.28, base: 0.36, slow: 0.58 },
  easings: { enter: [0.25, 1, 0.5, 1], exit: [0.5, 0, 1, 1] },
  springs: { press: { type: "spring", stiffness: 420, damping: 34, mass: 0.35 } },
});
```

- `durations`, `easings` and `springs` are **your vocabulary**: name them as you like. The framework never reads them. Your module motion files use them, so changing one easing re-times every module that refers to it.
- `tempo` stretches every duration, delay, stagger and choreography timer the modules play, including the ones you wrote. Springs are retuned to take tempo× as long at the same damping ratio. Write values at tempo 1.
- Pass the result to `<ThemeProvider motion={motion}>`. App code can read it back with `useMotionTokens()`, which also returns `reduced`: whether reduced motion is in effect. A nested `ThemeProvider` without `motion` keeps the one above it.

### 5.2 Module motion: `defineTheme(spec, { slots, motion })`

Each animating module exports its contract type. Give it a full value, the same way you give `slots`:

| Module | Spec | Contract type | What it holds |
| :--- | :--- | :--- | :--- |
| Dock | `dockTheme` | `DockMotion` | `transitions` (stack, expand, surface enter/step/exit/resize, cards, text, header swap, press, …), `variants` (fade, text crossfade, header swap/restore, controls, command bar, badge, hud, …), `deck` (elevation, compress, `peek(position)`, `exit(card)`, `tapScale`), `drag`, `skeleton`, `timings` (surface phase lengths and card staggers, in seconds) |
| Modal | `modalTheme` | `ModalMotion` | `backdrop`, `content`, `header`, `footer` variants, and `positions` (`center`, `top`, `right`, `bottom`, `left`: variants plus an optional own `transition`) |
| Notification | `notificationTheme` | `NotificationMotion` | `toast` variants and the toast's `transition` |
| Context menu | `contextMenuTheme` | `ContextMenuMotion` | `pop`, `content`, `item` variants (`item.visible` may take the row index), `itemTap`, `itemTransition` |
| Background | `backgroundTheme` | `BackgroundMotion` | `initial`, `animate`, `exit`, `transition`, `exitDurationFactor`. A page's own `background.animation` still wins field by field and follows your tempo too. |

```ts
// src/config/theme/dock.ts
import { defineTheme } from "@omerdlw/base-framework/theme";
import { dockTheme } from "@omerdlw/base-framework/modules/dock";
import { dockMotion } from "./motion/dock";

export const dockThemeConfig = defineTheme(dockTheme, { slots: { … }, motion: dockMotion });
```

Variant functions keep their `custom` signature (e.g. `commandBar.visible(index)`, `controlsContainer.hidden(targetY)`), and `deck.peek` / `deck.exit` receive what the dock knows from layout. Everything else about those values is yours.

If an animating module's theme has no `motion`, mounting it throws:
```
Motion for theme "dock" is missing. Add `motion` to its defineTheme(...) next to `slots` (start from the framework's templates/motion/).
```
`DockProvider` alone (without the dock theme) still runs: its surface phases advance immediately, since nothing is drawn.

### 5.3 The starter: `templates/motion/`

The package ships `templates/motion/` with `tokens.ts`, `dock.ts`, `modal.ts`, `notification.ts`, `context-menu.ts` and `background.ts`. It is a complete starting point (the motion the modules carried before motion moved into apps), type-checked against the module contracts. Copy the folder into your app (e.g. `src/config/theme/motion/`) and make it yours; the framework never reads it.

### 5.4 Reduced motion

Reduced motion is an accessibility mechanic, so the framework handles it once for every module:

- When it is in effect (`reducedMotion: "always"`, or `"user"` with the OS setting on), every module transition, including your own, collapses to `REDUCED_MOTION_TRANSITION` (0.08 s, linear, no delay). Every `timings` entry is capped at 0.08 s, so choreography doesn't hold the dock still on animations that aren't playing.
- `CoreProvider` wraps every module backdrop and overlay in `ModuleMotionConfig` (Motion's `MotionConfig` with your policy), so positional values (`width`, `height`, `x`, `scale`, …) jump instead of animating. App content outside the modules is untouched and keeps its own `MotionConfig`.

