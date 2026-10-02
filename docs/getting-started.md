# Getting Started with `@omerdlw/base-framework`

> **A complete step-by-step guide to installing, configuring, and building app-like Next.js 16 (App Router) & React 19 web applications with `@omerdlw/base-framework`.**

---

## 1. Prerequisites & Tech Stack

Before installing `@omerdlw/base-framework`, verify your environment:
- **Node.js:** `v20.0.0` or higher (Node 22 recommended)
- **Framework:** Next.js `15.0.0` or `16.0.0+` (App Router)
- **React:** React `19.0.0+` & React DOM `19.0.0+`
- **Styling:** Tailwind CSS v4

---

## 2. Installation

Install `@omerdlw/base-framework` alongside its required peer dependencies:

```bash
npm install @omerdlw/base-framework motion @iconify-icon/react @radix-ui/react-tooltip clsx tailwind-merge
```

### Peer Dependencies Breakdown

| Package | Purpose in Base Framework |
| :--- | :--- |
| `motion` (`>=12.0.0`) | Hardware GPU-accelerated motion presets (`translate3d`, `scale`, spring physics). |
| `@iconify-icon/react` | Unified SVG-free icon rendering via `<Icon icon="solar:..." />`. |
| `@radix-ui/react-tooltip` | Accessible WAI-ARIA tooltip primitives. |
| `clsx` & `tailwind-merge` | Backing utilities for `cn()` class merging. |

---

## 3. Tailwind CSS v4 Configuration

To ensure Tailwind scans the components, overlays, and atoms bundled inside `@omerdlw/base-framework`, add the package source to your main CSS file (e.g. `src/app/globals.css`):

```css
@import "tailwindcss";

/* 1. Instruct Tailwind to scan the Base Framework package files */
@source "../node_modules/@omerdlw/base-framework";

/* 2. Custom helper utility classes used by Base Framework */
@utility center {
  display: flex;
  align-items: center;
  justify-content: center;
}

@utility skeleton-block {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  background-color: rgb(255 255 255 / 0.08);
}
```

---

## 4. Setting Up Application Providers

Create a client-side provider component (e.g., `src/app/providers.tsx`) to mount `CoreProvider` and install your desired UI modules:

```tsx
"use client";

import React from "react";
import { CoreProvider } from "@omerdlw/base-framework/provider";
import { ThemeProvider } from "@omerdlw/base-framework/theme";

// Import desired first-party modules
import { dockModule } from "@omerdlw/base-framework/modules/dock";
import { modalModule } from "@omerdlw/base-framework/modules/modal";
import { notificationModule } from "@omerdlw/base-framework/modules/notification";
import { ambientModule } from "@omerdlw/base-framework/modules/ambient";
import { backgroundModule } from "@omerdlw/base-framework/modules/background";
import { controlsModule } from "@omerdlw/base-framework/modules/controls";
import { loadingModule } from "@omerdlw/base-framework/modules/loading";
import { contextMenuModule } from "@omerdlw/base-framework/modules/context-menu";

// Define the modules your application uses
const modules = [
  dockModule,
  modalModule,
  notificationModule,
  ambientModule,
  backgroundModule,
  controlsModule,
  loadingModule,
  contextMenuModule,
];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CoreProvider modules={modules}>
      {children}
    </CoreProvider>
  );
}
```

Then wrap your Root Layout in `src/app/layout.tsx`:

```tsx
import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "My Base Framework App",
  description: "Next.js application built with Base Framework",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## 5. Building Your First Route with `usePage()`

Downstream routes never manually render headers, docks, or modals. Instead, a route simply declares its desired visual state using `usePage()`:

Create `src/app/page.tsx`:

```tsx
"use client";

import { usePage } from "@omerdlw/base-framework/kernel";
import { Button, Icon } from "@omerdlw/base-framework/atoms";

export default function HomePage() {
  const page = usePage({
    title: "Dashboard",
    dock: {
      description: "Application Overview & Analytics",
      icon: "solar:widget-bold",
    },
    background: {
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
      overlay: true,
    },
  });

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
      <p className="mt-2 text-white/60">
        Notice how the dock, background, and title were automatically configured by the microkernel.
      </p>

      <div className="mt-6 flex gap-3">
        <Button
          onClick={() => page.modules.notification?.toast("Action triggered successfully!", { type: "success" })}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-black hover:bg-white/90"
        >
          <Icon icon="solar:bell-bold" size={16} />
          Show Notification
        </Button>
      </div>
    </main>
  );
}
```

---

## 6. Official Package Subpaths

`@omerdlw/base-framework` exposes 11 tree-shakable subpaths. Always import from the dedicated subpath:

| Subpath | Purpose | Key Exports |
| :--- | :--- | :--- |
| `@omerdlw/base-framework/kernel` | Microkernel engine | `usePage()`, `defineModule()`, `definePeer()`, `useModule()`, `useModuleState()` |
| `@omerdlw/base-framework/provider` | Root host component | `CoreProvider` |
| `@omerdlw/base-framework/modules/*` | 9 UI modules | `dockModule`, `modalModule`, `notificationModule`, `ambientModule`, etc. |
| `@omerdlw/base-framework/result` | Functional error handling | `Result<T, E>`, `ok()`, `err()`, `isResult()`, `createSafeAction()` |
| `@omerdlw/base-framework/events` | Cross-cutting event bus | `globalEvents`, `EVENT_TYPES`, `FrameworkEventMap` |
| `@omerdlw/base-framework/theme` | Declarative theme engine | `defineThemeSpec()`, `defineTheme()`, `ThemeProvider`, `useTheme()` |
| `@omerdlw/base-framework/atoms` | Unstyled accessible UI atoms | `Button`, `Icon`, `Spinner`, `Tooltip` |
| `@omerdlw/base-framework/hooks` | Universal React hooks | `useStore()`, `useClickOutside()`, `useGlobalEvent()`, `useRequiredContext()` |
| `@omerdlw/base-framework/utils` | Pure runtime utilities | `cn()`, `clamp()`, `debounce()`, `throttle()`, `createStore()`, `createScheduler()`, `report()` |
| `@omerdlw/base-framework/error` | Isolated error boundaries | `GlobalError`, `ModuleError`, `UserError`, `toUserMessage()` |
| `@omerdlw/base-framework/tokens` | Design & motion tokens | `DURATION_TOKENS`, `EASING_CURVES`, `SPRING_PRESETS`, `Z_INDEX` |

---

## 7. Next Steps

- Explore how visual design is configured via [Theming Guide (`theming.md`)](./theming.md).
- Learn how to build custom modules via [Custom Module Authoring (`custom-modules.md`)](./custom-modules.md).
- Read the [Architecture & 10 Rules (`architecture-and-rules.md`)](./architecture-and-rules.md) for strict architectural invariants.
