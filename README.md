# @omerdlw/base-framework

> **Microkernel orchestration engine and first-party declarative UI modules for app-like Next.js 16 (App Router) & React 19 web applications.**

[![npm version](https://img.shields.io/npm/v/@omerdlw/base-framework.svg)](https://www.npmjs.com/package/@omerdlw/base-framework)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript 5.8](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)

---

## 📖 Complete Documentation Index

For in-depth architecture guides and module-by-module references, explore the [`docs/`](./docs) folder:

### General Architecture Guides

- 🚀 **[Getting Started & Installation](./docs/getting-started.md)** — Step-by-step setup, Tailwind CSS v4, root layout wiring
- 🏛️ **[System Architecture Map](./docs/README.md)** — Macro overview, task lookup table, conventions
- 📐 **[Architecture & 10 Rules](./docs/architecture-and-rules.md)** — Package layer hierarchy, boundaries, decision tree
- 🎨 **[Theming System Guide](./docs/theming.md)** — Visual customization: defineTheme, ThemeProvider, slot reference
- 🧩 **[Custom Module Authoring](./docs/custom-modules.md)** — Build custom declarative modules with defineModule & usePage
- ⚙️ **[Core Engine Deep Dive](./docs/core-engine.md)** — CoreProvider, theme engine, event bus, pure utils & stores
- 🧪 **[Testing Guide](./docs/testing.md)** — 740-test suite, test harness, happy-dom, downstream testing
- 🤖 **[AI Agent Blueprint (`AGENTS.md`)](./templates/AGENTS.md)** — Drop-in rules for AI coding assistants

### Module & Component Reference

- ⚡ **[Microkernel Engine (`kernel`)](./docs/modules/kernel.md)** — `usePage()`, `defineModule()`, topological registry
- ⚓ **[Dock Module (`dock`)](./docs/modules/dock.md)** — Floating app chrome, cards, surfaces, flows, HUD, guards
- 🪟 **[Modal Module (`modal`)](./docs/modules/modal.md)** — Stackable dialogs, focus trap, smooth scroll lock
- 🔔 **[Notification Module (`notification`)](./docs/modules/notification.md)** — Toasts, `toast.fromResult`, auto 401 listener
- 🎨 **[Ambient Lighting (`ambient`)](./docs/modules/ambient.md)** — Media color extraction, OKLCH canvas glow
- 🖼️ **[Background Canvas (`background`)](./docs/modules/background.md)** — Multi-layer video, YouTube loop, cross-fades
- 🖱️ **[Context Menu (`context-menu`)](./docs/modules/context-menu.md)** — Viewport clamping, declarative menus
- 🎛️ **[Controls Module (`controls`)](./docs/modules/controls.md)** — Paired HUD action rails beside the dock
- ⏳ **[Loading & Skeleton (`loading`)](./docs/modules/loading.md)** — Coordinated loading, anti-flicker delay
- 🧭 **[Navigation (`navigation`)](./docs/modules/navigation.md)** — Exit holds, payload for the next page, back-button hold, intent prefetch
- 🎵 **[Media Transport (`media`)](./docs/modules/media.md)** — Session sync, leader vs audible displacement
- 🔒 **[Result Pattern (`result`)](./docs/modules/result.md)** — Functional `Result<T, E>`, `ok()`, `err()`
- 🛡️ **[Error Boundary (`error-boundary`)](./docs/modules/error-boundary.md)** — Isolated boundaries, deduplicating reporter

---

## ✨ Features

- ⚡ **Microkernel Architecture:** Ultra-lean orchestration host with topological module dependency sorting, transactional multi-source registry, and atomic route lifecycle commits.
- 🧩 **First-Party Declarative UI Modules:** 10 production-tested modules (`dock`, `modal`, `notification`, `ambient`, `background`, `context-menu`, `controls`, `loading`, `media`, `navigation`) that communicate strictly through typed contracts without tight coupling.
- 🎯 **Single Route Declaration (`usePage`):** Cleanly declare titles, navigation cards, modals, loading states, and background media in a single atomic hook call.
- 🔒 **Type-Safe Result Pattern (`Result<T, E>`):** Functional, bulletproof error handling with `ok()`, `err()`, and direct feedback bridging via `toast.fromResult()`.
- 🛡️ **Cross-Bundle Context Deduplication:** Guarantees stable React Context singletons across Next.js split chunks and monorepo boundaries.
- 🎨 **No design inside:** no CSS, tokens or motion values. Modules and components take every class, timing and icon from your app's theme and `defineUi`.

---

## 📦 Installation

```bash
npm install @omerdlw/base-framework motion
```

Ensure peer dependencies are satisfied (`next >= 15.0.0`, `react >= 19.2.0`, `react-dom >= 19.2.0`, `motion >= 12.0.0`).

Requires Node `>=22`. Upgrading from 3.x? See [MIGRATION.md](./MIGRATION.md).

---

## 🚀 Quick Start

### 1. Configure Providers in Your Next.js App

Create your client providers component (e.g. `src/app/providers.tsx`):

```tsx
"use client";

import { CoreProvider } from "@omerdlw/base-framework/provider";
import { dockModule } from "@omerdlw/base-framework/dock";
import { modalModule } from "@omerdlw/base-framework/modal";
import { notificationModule } from "@omerdlw/base-framework/notification";
import { ambientModule } from "@omerdlw/base-framework/ambient";
import { backgroundModule } from "@omerdlw/base-framework/background";
import { loadingModule } from "@omerdlw/base-framework/loading";
import { navigationModule } from "@omerdlw/base-framework/navigation";

const modules = [
  dockModule,
  modalModule,
  notificationModule,
  ambientModule,
  backgroundModule,
  loadingModule,
  navigationModule,
];

export function Providers({ children }: { children: React.ReactNode }) {
  return <CoreProvider modules={modules}>{children}</CoreProvider>;
}
```

Wrap your root `app/layout.tsx`:

```tsx
import { Providers } from "./providers";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 2. Tailwind CSS v4 Configuration

Add the package path to your `@source` scanning inside `src/app/globals.css`:

```css
@import "tailwindcss";
@source "../node_modules/@omerdlw/base-framework";
```

### 3. Declare Route State with `usePage`

In any route client component:

```tsx
"use client";

import { usePage } from "@omerdlw/base-framework/kernel";

export default function DashboardPage() {
  const page = usePage({
    title: "Analytics Dashboard",
    dock: {
      description: "Live system metrics and user activity",
      icon: "solar:widget-bold",
    },
    background: {
      image: "/media/dashboard-bg.webp",
      overlay: true,
    },
    loading: false,
  });

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Analytics</h1>
      <button
        onClick={() => page.modules.notification?.toast("Data refreshed!")}
        className="mt-4 rounded bg-white px-4 py-2 font-semibold text-black"
      >
        Refresh
      </button>
    </main>
  );
}
```

---

## 📚 Subpath Export Directory

| Subpath                            | Purpose & Key Exports                                                                    |
| :--------------------------------- | :--------------------------------------------------------------------------------------- |
| `@omerdlw/base-framework`          | Root exports of all sub-systems                                                          |
| `@omerdlw/base-framework/kernel`   | `usePage`, `defineModule`, `definePeer`, `ModuleHost`, `getOrCreateGlobalContext`        |
| `@omerdlw/base-framework/provider` | `CoreProvider` composition pipeline                                                      |
| `@omerdlw/base-framework/result`   | `ok()`, `err()`, `isResult()`, `type Result<T, E>`                                       |
| `@omerdlw/base-framework/events`   | Decoupled event bus (`globalEvents`, `EVENT_TYPES`)                                      |
| `@omerdlw/base-framework/theme`    | `ThemeProvider`, `useTheme`, `defineThemeSpec`                                           |
| `@omerdlw/base-framework/ui`       | Unstyled components the app gives a look (`Button`, `Icon`, `Select`, …)                 |
| `@omerdlw/base-framework/recipes`  | Server-safe `defineUi`, recipes, `cn`, `createCn`, `ANATOMY`                             |
| `@omerdlw/base-framework/utils`    | Pure utilities (`report`, `createStore`, `createScheduler`, `defineMotion`)              |
| `@omerdlw/base-framework/hooks`    | Essential hooks (`useClickOutside`, `useGlobalEvent`, `useStore`)                        |
| `@omerdlw/base-framework/error`    | Error boundaries (`GlobalError`, `ModuleError`, `ComponentError`) and `getErrorReporter` |
| `@omerdlw/base-framework/<module>` | 10 standalone modules (`dock`, `modal`, `notification`, `navigation`, etc.)              |

---

## 🤖 For AI Coding Assistants (Cursor, Antigravity, Claude Code)

When developing a project that consumes `@omerdlw/base-framework`, copy [`templates/AGENTS.md`](./templates/AGENTS.md) into your downstream project root as `AGENTS.md`. This gives the AI assistant instant, complete context over the framework's strict rules, boundaries, and best practices.

---

## 📄 License

MIT © [Ömer Deliavcı](https://github.com/omerdlw)
