# Theming System Guide — `@omerdlw/base-framework/theme`

> **Read this first if you need to:** customize the visual design of any first-party module (`dock`, `modal`, `notification`, etc.), supply custom Tailwind styles, or understand the theme slot contract.

---

## 1. Philosophy: Logic Decoupled from Aesthetics

`@omerdlw/base-framework` enforces a strict rule: **Modules own interaction mechanics, accessibility, and state machines; consumer applications own visual design.**

Modules ship with **zero hardcoded visual Tailwind colors or aesthetic choices**. Instead, each module declares a typed **Theme Spec** defining required "slots" (e.g. `card`, `backdrop`, `header`, `item`).

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

### 2.1 `defineThemeSpec<Slots>(id)`
Used by module authors to define the contract:
```ts
export type DockThemeSlot = "card" | "header" | "title" | "description" | "icon" | "surface";
export const dockTheme = defineThemeSpec<DockThemeSlot>("dock");
```

### 2.2 `defineTheme(spec, { slots, styles? })`
Used by application developers to implement the styling contract. TypeScript enforces that **every required slot** is provided:
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

### 2.3 `ThemeProvider({ themes, children })`
Wraps your application or `CoreProvider` to supply the theme map:
```tsx
<ThemeProvider themes={[dockThemeConfig, modalThemeConfig, notificationThemeConfig]}>
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

Then in `src/app/providers.tsx`:

```tsx
"use client";

import { ThemeProvider } from "@omerdlw/base-framework/theme";
import { CoreProvider } from "@omerdlw/base-framework/provider";
import { appThemes } from "@/config/themes";
import { modules } from "@/config/modules";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider themes={appThemes}>
      <CoreProvider modules={modules}>{children}</CoreProvider>
    </ThemeProvider>
  );
}
```
