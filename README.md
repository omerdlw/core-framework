# @omerdlw/base-framework

> Microkernel orchestration engine and first-party declarative UI modules for app-like Next.js 16 (App Router) & React 19 web applications.

[![npm version](https://img.shields.io/npm/v/@omerdlw/base-framework.svg)](https://www.npmjs.com/package/@omerdlw/base-framework)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

- ⚡ **Microkernel Architecture:** Ultra-lightweight registry, transaction pipelines, and decoupled module lifecycle.
- 🧩 **First-Party Declarative Modules:**
  - `dock` — Floating app-like dock with navigation, cards, and state continuity.
  - `modal` — Stackable, accessible modals with hardware-accelerated animations.
  - `notification` — Toast notifications with promise and result tracking.
  - `ambient` — Dynamic background and color extraction from media.
  - `background` — Video, image, and interactive backgrounds with YouTube support.
  - `context-menu` — Contextual right-click menus with scope isolation.
  - `controls` — Route-level HUD controls.
  - `loading` — Coordinated loading states with skeleton blocks.
  - `media` — Synchronized media transport controller.
- 🔒 **Type-Safe Result & Events:** Functional error-handling (`Result<T, E>`) and type-safe decoupled pub/sub events.
- 🎨 **Theme Engine:** Semantic OKLCH tokens, design slots, and hardware GPU accelerated motion presets.
- 🛡️ **Guaranteed Context Deduplication:** Cross-bundle resilient React context registry preventing multi-chunk split issues.

---

## 📦 Installation

```bash
npm install @omerdlw/base-framework motion
```

---

## 🚀 Quick Start

### 1. Wrap Your App with `CoreProvider`

In your `app/providers.tsx` (Client Component):

```tsx
"use client";

import { CoreProvider } from "@omerdlw/base-framework/provider";
import { dockModule } from "@omerdlw/base-framework/modules/dock";
import { modalModule } from "@omerdlw/base-framework/modules/modal";
import { notificationModule } from "@omerdlw/base-framework/modules/notification";

const modules = [dockModule, modalModule, notificationModule];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CoreProvider modules={modules}>
      {children}
    </CoreProvider>
  );
}
```

### 2. Configure Route State with `usePage`

In any route client component:

```tsx
"use client";

import { usePage } from "@omerdlw/base-framework/kernel";

export default function MyPage() {
  usePage({
    dock: {
      title: "Dashboard",
      icon: "solar:widget-bold",
    },
    loading: {
      isLoading: false,
    },
  });

  return <main>Page Content</main>;
}
```

### 3. Tailwind CSS v4 Integration

If you use Tailwind CSS v4, include the package in your `@source` scanning inside `globals.css`:

```css
@import "tailwindcss";
@source "../node_modules/@omerdlw/base-framework";
```

---

## 📚 Subpath Exports

| Export Path | Purpose |
| :--- | :--- |
| `@omerdlw/base-framework` | Root exports |
| `@omerdlw/base-framework/kernel` | Microkernel engine, registry hooks, module host |
| `@omerdlw/base-framework/provider` | `CoreProvider` composition pipeline |
| `@omerdlw/base-framework/theme` | `ThemeProvider`, `defineTheme`, `useTheme` |
| `@omerdlw/base-framework/tokens` | Stacking order (`Z_INDEX`), motion timing, easing |
| `@omerdlw/base-framework/result` | Functional `ok()`, `err()`, safe action wrappers |
| `@omerdlw/base-framework/events` | Decoupled event bus (`globalEvents`, `EVENT_TYPES`) |
| `@omerdlw/base-framework/utils` | DOM helpers, string/object helpers, store primitives |
| `@omerdlw/base-framework/hooks` | React utility hooks |
| `@omerdlw/base-framework/error` | Global and module-level error boundaries |
| `@omerdlw/base-framework/modules/*` | Individual domain modules (`dock`, `modal`, etc.) |

---

## 📄 License

MIT © [Ömer Dilavever](https://github.com/omerdlw)
