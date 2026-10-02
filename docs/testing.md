# Testing Guide

> **Read this first if you need to:** run package tests, understand the test harness (`happy-dom`, `renderHook`, `Themed`), write tests for new modules, or test downstream components that consume `@omerdlw/base-framework`.
>
> **Stack:** Node's built-in test runner (`node:test`) + `node:assert/strict`, TypeScript executed directly through a resolver hook (`register.mjs`), `happy-dom` for React components and hooks, zero external framework overhead.

---

## 1. Running Tests

| Command | Purpose |
| :--- | :--- |
| `npm test` | Runs the full 520+ test suite (`tests/**/*.test.ts`) in ~1 second. |
| `npm run test:coverage` | Runs the suite with complete line, branch, and function coverage reporting for `src/**`. |
| `npm run type-check` | Full TypeScript compiler validation (`tsc --noEmit`). |
| `npm run check:architecture` | Static AST validation checking for 0 circular dependencies and verified `uses` peer declarations. |
| `node --import ./tests/support/register.mjs --test tests/core/kernel.test.ts` | Run a single test file. |
| `node --import ./tests/support/register.mjs --test --test-name-pattern="surface" tests/modules/dock.test.ts` | Run tests matching a specific pattern. |

**Pre-flight Verification:**  
`npm run type-check && npm run lint && npm run check:architecture && npm test && npm run build`

---

## 2. Test Suite Layout

Tests mirror the package's architecture, **one TypeScript test file per unit**:

```
tests/
  architecture.test.ts     Layer boundaries, module contracts, barrel exports, cyclical imports
  core/                    Microkernel, error handling, hooks, atoms, tokens, utils, events, result, theme
  modules/                 ambient, background, context-menu, controls, dock, loading, media, modal, notification
  support/                 Test harness: happy-dom, render, themed wrapper, stubs (§3)
  tsconfig.json            TypeScript compilation rules for tests
```

---

## 3. Test Harness (`tests/support`)

| File | Provides |
| :--- | :--- |
| `register.mjs` | Node module loader hook: resolves `@omerdlw/base-framework` imports on the fly and transpiles TypeScript. |
| `dom.ts` | Configures a **`happy-dom`** browser environment (`window`, `document`, `matchMedia`, observers) for React component and hook testing. |
| `render.ts` | React 19 testing primitives: `render(element)`, `renderHook(hook, { wrapper })`, `flush()`. Automatically unmounts trees after every test to prevent leaks. |
| `themes.ts` | `Themed` (`ThemeProvider` loaded with test themes) and `withThemes()`. Required when testing any module view or atom that consumes theme slots. |
| `registry.ts` | Test registry with `builtInModules` for microkernel and module integration testing. |

---

## 4. Testing Patterns

### 4.1 Testing Pure Utils & Math

Import the utility directly and assert deterministic behavior:

```ts
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { clamp, toFiniteNumber } from "@omerdlw/base-framework/utils";

describe("math utils", () => {
  test("clamp restricts numbers within min and max boundaries", () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-5, 0, 10), 0);
    assert.equal(clamp(15, 0, 10), 10);
  });

  test("toFiniteNumber handles non-numeric fallbacks", () => {
    assert.equal(toFiniteNumber("123"), 123);
    assert.equal(toFiniteNumber(NaN, 0), 0);
  });
});
```

### 4.2 Testing Hooks & Subscriptions

Render hooks inside `Themed` or `CoreProvider` using `renderHook`:

```ts
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { renderHook } from "../support/render.ts";
import { useGlobalEvent } from "@omerdlw/base-framework/hooks";
import { globalEvents, EVENT_TYPES } from "@omerdlw/base-framework/events";

describe("useGlobalEvent", () => {
  test("receives published event payloads", () => {
    let received = null;
    const { unmount } = renderHook(() => {
      useGlobalEvent(EVENT_TYPES.STATE_CHANGE, (payload) => {
        received = payload;
      });
    });

    globalEvents.publish(EVENT_TYPES.STATE_CHANGE, { key: "auth", value: true });
    assert.deepEqual(received, { key: "auth", value: true });

    unmount();
  });
});
```

### 4.3 Testing Diagnostics & Error Reports

Install an ephemeral report sink with `setReportSink` and release it in cleanup:

```ts
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { report, setReportSink } from "@omerdlw/base-framework/utils";

describe("error reporter", () => {
  test("routes diagnostic messages to the configured sink", () => {
    const logs: any[] = [];
    const release = setReportSink((scope, err, level) => {
      logs.push({ scope, err, level });
    });

    report("dock", new Error("Invalid surface state"), "warning");
    release();

    assert.equal(logs.length, 1);
    assert.equal(logs[0].scope, "dock");
    assert.equal(logs[0].level, "warning");
  });
});
```

---

## 5. Testing Downstream Applications

When testing Next.js components or pages that consume `@omerdlw/base-framework`:

1. **Wrapping with `CoreProvider`:** Provide a test wrapper with the required modules:
   ```tsx
   import { CoreProvider } from "@omerdlw/base-framework/provider";
   import { dockModule } from "@omerdlw/base-framework/modules/dock";
   import { notificationModule } from "@omerdlw/base-framework/modules/notification";

   export function TestProviders({ children }: { children: React.ReactNode }) {
     return <CoreProvider modules={[dockModule, notificationModule]}>{children}</CoreProvider>;
   }
   ```
2. **Testing Declarative Routes (`usePage`):** Since `usePage()` accepts a static or reactive configuration object, verify that components invoke `usePage()` with the expected metadata, loading flags, or dock card configs.
3. **Asserting Server Action Results:** Verify that Server Actions return `Result<T, E>` (`ok()` or `err()`) rather than throwing raw unhandled exceptions.

---

## 6. What the Suite Protects

| Layer | Enforced Invariants |
| :--- | :--- |
| **Architecture** | 0 circular dependencies, downward-only imports, clean barrel exports |
| **Microkernel** | Registry ordering, topological provider nesting, `usePage` atomic reconciliation |
| **Modules** | Dock flows/surfaces/guards/status, modal stack order, context-menu scoring, controls rails, notification queues, media sessions |
| **Atoms** | Accessibility contracts (ARIA), keyboard navigation, deterministic `cn()` class merging |
| **Tokens & Theme** | GPU-accelerated motion presets, OKLCH token boundaries, Z-index hierarchy |
