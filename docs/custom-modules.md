# Custom Module Authoring Guide — `@omerdlw/base-framework/kernel`

> **Read this first if you need to:** create a new declarative module for your application (e.g. an Audio Player, Command Palette, or Interactive Onboarding Tour), hook into `usePage()`, or register custom items in the microkernel's transactional registry.

---

## 1. Overview: The Microkernel Extensibility Model

The core strength of `@omerdlw/base-framework` is its **inversion-of-control microkernel**. The kernel knows *no module by name*. All 9 built-in modules (`dock`, `modal`, `notification`, etc.) are authored using the exact same public API available to you: `defineModule()`.

When you register a module in `<CoreProvider modules={[myModule, ...]}>`:
1. The kernel validates uniqueness of the module's `id`.
2. The kernel topologically sorts dependencies declared in `uses: ["peerModule"]` so that providers are nested in guaranteed dependency order.
3. The kernel mounts the module's `<Provider>`, renders its `<Backdrop>` behind `{children}`, and renders its `<Overlay>` in an isolated error boundary above `{children}`.
4. The kernel wires your module into `usePage()`, allowing any route in your application to declare configuration for your module.

---

## 2. Anatomy of a CoreModule

```ts
import { defineModule } from "@omerdlw/base-framework/kernel";

export const myModule = defineModule({
  id: "myModule",                    // Unique string identifier
  uses: ["dock"],                    // Peer dependencies (determines mounting order)
  Provider: MyContextProvider,       // Optional: Context provider wrapping application children
  Backdrop: MyBackdropLayer,         // Optional: Rendered behind children (e.g. canvas, ambient lighting)
  Overlay: MyOverlayLayer,           // Optional: Rendered above children in an error boundary (e.g. sheets, dialogs)
  registry: {                        // Optional: Registry definition for transactional data
    keyPolicy: "named",              // "singleton" | "named" | "path" | "route"
    lifecycle: "route",              // "immediate" | "graceful" | "persistent" | "route"
  },
  page: {                            // Optional: usePage() integration
    select: (config) => config.myModule,
    entries: (slice, context) => [...],
    use: (slice, { set }) => ({ ... }),
  },
});
```

---

## 3. Step-by-Step Tutorial: Building a "Tour Guide" Module

Let's create a custom **Onboarding Tour Module** that allows any page to declare step-by-step tooltips via `usePage({ tour: [...] })`.

### Step 1: Define Types & Theme Spec

Create `src/modules/tour/types.ts`:

```ts
export interface TourStep {
  target: string;      // CSS selector or data attribute
  title: string;
  description: string;
}

export interface TourConfig {
  steps: TourStep[];
  autoStart?: boolean;
}

export interface TourPageApi {
  start: () => void;
  next: () => void;
  stop: () => void;
}
```

Create `src/modules/tour/constants.ts`:

```ts
import { defineThemeSpec } from "@omerdlw/base-framework/theme";

export type TourThemeSlot = "card" | "title" | "description" | "nextButton" | "skipButton";
export const tourTheme = defineThemeSpec<TourThemeSlot>("tour");
```

---

### Step 2: Create the State & Context

Create `src/modules/tour/context.tsx`:

```tsx
"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import type { TourStep } from "./types";

interface TourContextValue {
  currentStepIndex: number;
  currentStep: TourStep | null;
  isActive: boolean;
  start: () => void;
  next: () => void;
  stop: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children?: React.ReactNode }) {
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const value = useMemo<TourContextValue>(() => ({
    currentStepIndex: index,
    currentStep: isActive ? steps[index] ?? null : null,
    isActive,
    start: () => { setIndex(0); setIsActive(true); },
    next: () => {
      if (index + 1 < steps.length) setIndex(index + 1);
      else setIsActive(false);
    },
    stop: () => setIsActive(false),
  }), [index, isActive, steps]);

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
```

---

### Step 3: Create the Visual Overlay

Create `src/modules/tour/overlay.tsx`:

```tsx
"use client";

import React from "react";
import { useTheme } from "@omerdlw/base-framework/theme";
import { Button } from "@omerdlw/base-framework/atoms";
import { useTour } from "./context";
import { tourTheme } from "./constants";

export function TourOverlay() {
  const { currentStep, isActive, next, stop } = useTour();
  const theme = useTheme(tourTheme);

  if (!isActive || !currentStep) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className={`${theme.slots.card} pointer-events-auto`}>
        <h3 className={theme.slots.title}>{currentStep.title}</h3>
        <p className={theme.slots.description}>{currentStep.description}</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={stop} className={theme.slots.skipButton}>Skip</Button>
          <Button onClick={next} className={theme.slots.nextButton}>Next</Button>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 4: Define the Module & Wire into `usePage`

Create `src/modules/tour/module.tsx`:

```tsx
"use client";

import { defineModule } from "@omerdlw/base-framework/kernel";
import { TourProvider, useTour } from "./context";
import { TourOverlay } from "./overlay";
import type { TourConfig, TourPageApi } from "./types";

export const tourModule = defineModule<
  "tour",
  null,
  TourConfig,
  TourPageApi
>({
  id: "tour",
  Provider: TourProvider,
  Overlay: TourOverlay,
  page: {
    select: (config) => config.tour,
    use: (slice, { set }) => {
      const { start, next, stop } = useTour();
      return { start, next, stop };
    },
  },
});

// TypeScript type augmentation for auto-complete in usePage()
declare module "@omerdlw/base-framework/kernel" {
  interface PageConfig {
    tour?: TourConfig;
  }
}
```

Create `src/modules/tour/index.ts`:

```ts
export * from "./types";
export * from "./constants";
export * from "./context";
export * from "./module";
```

---

## 4. Consuming Your Custom Module

### 1. Mount in `<CoreProvider>`:

In `src/app/providers.tsx`:

```tsx
import { CoreProvider } from "@omerdlw/base-framework/provider";
import { dockModule } from "@omerdlw/base-framework/modules/dock";
import { tourModule } from "@/modules/tour";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CoreProvider modules={[dockModule, tourModule]}>
      {children}
    </CoreProvider>
  );
}
```

### 2. Declare in Any Page Route:

In `src/app/dashboard/page.tsx`:

```tsx
"use client";

import { usePage } from "@omerdlw/base-framework/kernel";

export default function DashboardPage() {
  const page = usePage({
    title: "Dashboard",
    tour: {
      steps: [
        { target: "#metrics", title: "Key Metrics", description: "Monitor your KPIs here in real time." },
        { target: "#export", title: "Export Data", description: "Download CSV reports with one click." },
      ],
    },
  });

  return (
    <div>
      <button onClick={() => page.modules.tour?.start()}>
        Take a Tour
      </button>
    </div>
  );
}
```

Notice that `page.modules.tour` is **fully type-safe** and auto-completed by TypeScript!
