# Base Framework — AI Agent & Developer Mastery Guide

> **This project is powered by `@omerdlw/base-framework`.**  
> Read this file first before reading or modifying any code. It contains the exact architectural boundaries, rules, patterns, and code recipes you must follow without exception.

---

## 1. Quick Tech Stack & Foundations

- **Engine:** Next.js 16 (App Router), React 19
- **Core Framework:** `@omerdlw/base-framework` (Microkernel & Declarative UI Modules)
- **Styling:** Tailwind CSS v4 (`@theme`, OKLCH semantic color tokens, `.center`, `.skeleton-block`)
- **Motion:** Motion (v13) with hardware GPU acceleration (`translate3d`, `scale`)
- **Icons:** `@iconify-icon/react` via `<Icon icon="solar:..." />`

---

## 2. The 4-Layer Architectural Hierarchy

Code in this project strictly follows a four-layer dependency hierarchy:

```
Layer 4: src/app (Routing, Next.js page composition & layout orchestration)
   ↓ imports
Layer 3: src/features (Domain capabilities: auth, account, social, checkout)
   ↓ imports
Layer 2: src/infrastructure (Adapters: database, HTTP client, proxy, rate limiting)
   ↓ imports
Layer 1: @omerdlw/base-framework (Microkernel, first-party modules, atoms, tokens, result)
```

### Strict Architectural Boundaries:
- `src/features/*` must **never** import from `src/app/*`.
- `src/infrastructure/*` must **never** import from `src/features/*` or `src/app/*`.
- Every feature in `src/features/` **must** have an `index.ts` barrel export.
- Server database and adapter files **must** begin with `import "server-only";`.
- Server Actions **must** begin with `"use server";` and return `Result<T, E>` (`ok()` or `err()`).

---

## 3. The 5 Golden Rules of Base Framework

### Rule 1: Declarative Chrome (`usePage`)
**Never** build custom top navigation bars, ad-hoc sticky headers, or scattered floating buttons.  
All route-level visual state (title, dock card, loading state, background, modals) **must** be declared using `usePage()` from `@omerdlw/base-framework/kernel`:

```tsx
"use client";

import { usePage } from "@omerdlw/base-framework/kernel";

export default function MyPage() {
  const page = usePage({
    title: "Dashboard",
    dock: {
      description: "Project metrics and activity",
      icon: "solar:widget-bold",
    },
    loading: false,
  });

  return <main>...</main>;
}
```

### Rule 2: Result Pattern for All Async Operations
Never return raw unchecked errors or throw unhandled exceptions from server actions or infrastructure operations. Always wrap return values with `Result<T, E>` from `@omerdlw/base-framework/result`:

```tsx
"use server";

import "server-only";
import { ok, err, type Result } from "@omerdlw/base-framework/result";

export async function updateProfile(username: string): Promise<Result<{ id: string }, string>> {
  if (!username) return err("Username is required");
  // Save to DB...
  return ok({ id: "user_123" });
}
```

### Rule 3: Bridge Server Actions to Feedback with `toast.fromResult`
When consuming Server Actions in the UI, do not write manual `try/catch` and `if (res.error)` blocks. Use `toast.fromResult()`:

```tsx
"use client";

import { useToast } from "@omerdlw/base-framework/modules/notification";
import { updateProfile } from "@/features/account/actions";

export function ProfileForm() {
  const { toast } = useToast();

  const handleSubmit = async (name: string) => {
    const result = await updateProfile(name);
    toast.fromResult(result, {
      success: "Profile updated successfully!",
    });
  };

  return <form>...</form>;
}
```

### Rule 4: Subpath Imports Only
Always import from the exact subpaths exposed by `@omerdlw/base-framework`:

| What you need | Where to import it |
| :--- | :--- |
| `usePage`, `defineModule` | `@omerdlw/base-framework/kernel` |
| `CoreProvider` | `@omerdlw/base-framework/provider` |
| `ok`, `err`, `isResult`, `type Result` | `@omerdlw/base-framework/result` |
| `globalEvents`, `EVENT_TYPES` | `@omerdlw/base-framework/events` |
| `useToast` | `@omerdlw/base-framework/modules/notification` |
| `useDockActions`, `useDockStatus` | `@omerdlw/base-framework/modules/dock` |
| `useModal`, `useModalContext` | `@omerdlw/base-framework/modules/modal` |
| `useAmbientTheme` | `@omerdlw/base-framework/modules/ambient` |
| `cn`, `report`, `createStore` | `@omerdlw/base-framework/utils` |
| `useClickOutside`, `useGlobalEvent` | `@omerdlw/base-framework/hooks` |
| `Button`, `Icon`, `Spinner`, `Tooltip` | `@omerdlw/base-framework/atoms` |

### Rule 5: Modals and Surfaces Must Be Declared or Scoped
Do not create floating unmanaged `fixed z-50` dialog div wrappers.
- For sheets/drawers sliding up from the dock: use `useDockActions().openSurface(...)`.
- For standard dialogs: register them in `usePage({ modal: { ... } })` or trigger with `useModal().openModal(...)`.

---

## 4. Standard Next.js Root Layout Recipe

In `src/app/providers.tsx`:

```tsx
"use client";

import { CoreProvider } from "@omerdlw/base-framework/provider";
import { dockModule } from "@omerdlw/base-framework/modules/dock";
import { modalModule } from "@omerdlw/base-framework/modules/modal";
import { notificationModule } from "@omerdlw/base-framework/modules/notification";
import { ambientModule } from "@omerdlw/base-framework/modules/ambient";
import { backgroundModule } from "@omerdlw/base-framework/modules/background";
import { controlsModule } from "@omerdlw/base-framework/modules/controls";
import { loadingModule } from "@omerdlw/base-framework/modules/loading";

const modules = [
  dockModule,
  modalModule,
  notificationModule,
  ambientModule,
  backgroundModule,
  controlsModule,
  loadingModule,
];

export function Providers({ children }: { children: React.ReactNode }) {
  return <CoreProvider modules={modules}>{children}</CoreProvider>;
}
```

In `src/app/globals.css`:

```css
@import "tailwindcss";
@source "../node_modules/@omerdlw/base-framework";
```
