# @omerdlw/base-framework

A microkernel and a set of declarative UI modules for app-like Next.js (App Router) and React 19 products.

[![npm version](https://img.shields.io/npm/v/@omerdlw/base-framework.svg)](https://www.npmjs.com/package/@omerdlw/base-framework)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A page describes the chrome it needs (its dock card, background, modals, loading state) in one `usePage()` call. The kernel collects those declarations from every mounted route, resolves conflicts by priority and lifecycle, and hands each slice to the module that renders it. Modules never import each other's internals; they meet through typed contracts, peers and an event bus.

The framework holds no design. Every class, timing and icon comes from the app's theme, so two products built on it look nothing alike.

## Architecture

```
src/
├── foundation/   Layer 0  Pure and server-safe: Result, event bus, utils, recipes
├── react/        Layer 1  React primitives: hooks, theme, headless UI components
├── core/         Layer 2  Kernel (registry, module host, usePage), errors, navigation
└── modules/      Layer 3  dock, modal, notification, background, ambient, …
```

- **Layers only import downwards.** The foundation never touches React or the DOM and is safe in Server Components and Edge functions.
- **Modules are isolated.** A module reaches another only through its public barrel, and only when it declares it in `uses`.
- **Code is grouped by feature.** Small modules use one flat folder; the dock splits into `stack/`, `card/`, `routing/`, `surface/` and so on.

`npm run check:architecture` enforces the first two, along with the absence of import cycles and a 500-line limit per file. The full set of rules is in [docs/architecture-and-rules.md](./docs/architecture-and-rules.md).

## Modules

| Module                                           | What it does                                                            |
| :----------------------------------------------- | :---------------------------------------------------------------------- |
| [`dock`](./docs/modules/dock.md)                 | Floating app chrome: route cards, surfaces and flows, HUD, guards.      |
| [`modal`](./docs/modules/modal.md)               | Stackable dialogs with focus trap and scroll lock.                      |
| [`notification`](./docs/modules/notification.md) | Toasts, `toast.fromResult`, session-expiry handling.                    |
| [`navigation`](./docs/modules/navigation.md)     | Exit holds, payloads for the next page, back-button holds, prefetch.    |
| [`background`](./docs/modules/background.md)     | Layered video and image backgrounds, YouTube loops, cross-fades.        |
| [`ambient`](./docs/modules/ambient.md)           | Palette extraction from media, applied as CSS variables.                |
| [`context-menu`](./docs/modules/context-menu.md) | Declarative, route-aware context menus.                                 |
| [`controls`](./docs/modules/controls.md)         | Paired action rails beside the dock.                                    |
| [`loading`](./docs/modules/loading.md)           | Coordinated loading states with an anti-flicker delay.                  |
| [`media`](./docs/modules/media.md)               | One media session across players, with audible and leader displacement. |

## Installation

```bash
npm install @omerdlw/base-framework motion
```

Peer dependencies: `next >= 15`, `react >= 19.2`, `react-dom >= 19.2`, `motion >= 12`. Node 22 or later. Upgrading from 3.x? See [MIGRATION.md](./MIGRATION.md).

## Quick start

### 1. Install the modules

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

### 2. Let Tailwind see the package

Add the package path to your `@source` scanning inside `src/app/globals.css`:

```css
@import "tailwindcss";
@source "../node_modules/@omerdlw/base-framework";
```

### 3. Declare a page

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

## Public entry points

| Subpath | Purpose & Key Exports |
| :

Only these subpaths are public. File paths inside `dist/` are not part of the API.

## Documentation

- [Getting started](./docs/getting-started.md): installation, Tailwind, root layout
- [Architecture and rules](./docs/architecture-and-rules.md): layers, module layout, the ten rules
- [Core engine](./docs/core-engine.md): `CoreProvider`, themes, event bus, stores
- [Theming](./docs/theming.md): `defineTheme`, `ThemeProvider`, motion tokens
- [Custom modules](./docs/custom-modules.md): writing a module with `defineModule` and `usePage`
- [Module reference](./docs/modules/README.md): one page per module
- [Testing](./docs/testing.md): the test harness and testing downstream apps

Working with an AI coding assistant? Copy [`templates/AGENTS.md`](./templates/AGENTS.md) into your app as `AGENTS.md`.

## Development

```bash
npm install
npm run verify   # format, lint, type-check, architecture, tests, build, dist smoke tests
```

Tests run with Node's built-in test runner on the uncompiled source; the build compiles client entries with the React Compiler and smoke-tests the bundle.

## License

MIT © [Ömer Deliavcı](https://github.com/omerdlw)
