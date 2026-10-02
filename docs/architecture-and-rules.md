# Architecture, Boundaries & The 10 Inviolable Rules

> **Read this first if you are about to:** contribute to `@omerdlw/base-framework`, author or modify a module, structure downstream application code that consumes the package, or understand how the microkernel enforces layer boundaries.

---

## 1. The Package Architecture Hierarchy

`@omerdlw/base-framework` is built as an ultra-lean microkernel orchestrating self-contained declarative UI modules:

```
@omerdlw/base-framework/modules/*    (3. Declarative UI Modules: dock, modal, notification, ambient, background, controls, loading, media, context-menu)
   ↓ imports
@omerdlw/base-framework/{kernel, provider, theme, error} (2. Orchestration Engine: ModuleHost, RegistryStore, PageController, Error Boundaries)
   ↓ imports
@omerdlw/base-framework/{atoms, hooks} (1. React Layer: Accessible atoms & universal React hooks)
   ↓ imports
@omerdlw/base-framework/{utils, tokens, result, events} (0. Pure Foundation: Zero React dependencies, server & edge safe)
```

### 1.1 Layer Invariants

1. **Downwards Only:** Higher layers may import from lower layers; a lower layer **never** imports from a higher layer.
2. **Server-Safe Foundation:** `@omerdlw/base-framework/utils`, `tokens`, `result`, and `events` have **zero dependencies on React or Next.js DOM**. They can be imported safely in Server Components, Route Handlers, Server Actions, and Edge functions.
3. **Module Isolation:** Modules are strict siblings. A module (`dock`, `modal`, etc.) **must never import from another module**. Cross-module communication occurs strictly via declared peers (`uses: ["peerId"]`), `useModuleState()`, or `globalEvents`.
4. **No Deep Imports:** Public consumers import only from official subpath exports (`@omerdlw/base-framework/kernel`, `@omerdlw/base-framework/modules/dock`). Direct file-path imports (e.g., `@omerdlw/base-framework/dist/kernel/page.js`) are forbidden.
5. **Zero Cycles:** All package internal code maintains 0 cyclical dependencies, verified statically by `npm run check:architecture`.

---

## 2. Canonical Module File Pattern

Every first-party module inside `src/modules/<name>/` strictly adheres to a canonical slot pattern:

| File | Responsibility | Required? |
| :--- | :--- | :---: |
| `index.ts` | Clean barrel export (public API types, hooks, module definition). | ✅ |
| `types.ts` | Complete TypeScript type contracts and state interfaces (no runtime code). | ✅ |
| `constants.ts` | Module identifier, theme spec definition (`defineThemeSpec`), constants. | ✅ |
| `utils.ts` | Pure deterministic helper functions (zero React state). | ✅ |
| `module.tsx` | Module definition via `defineModule()`, `declare module` type augmentations. | ✅ |
| `context.tsx` | React Context, Provider, and `useX()` hooks (**at most one context per module**). | Optional |
| `state.ts` | Initial state factory, pure reducers, state transition functions. | Optional |
| `hooks.ts` | Component view-models (e.g. `useDockOverlayModel`). | Optional |
| `overlay.tsx` | Pure visual JSX presentation (consumes view-models; defines no state or refs). | Optional |
| `motion.ts` | Module-specific animation presets derived from `@omerdlw/base-framework/tokens`. | Optional |

---

## 3. The 10 Inviolable Rules

### Rule 1: Zero Cross-Module Imports
Modules must remain completely decoupled. Never import from another module directly.
- ❌ `import { useDock } from "@omerdlw/base-framework/modules/dock"` inside `src/modules/modal/overlay.tsx`
- ✅ Declare the peer dependency in `module.tsx` (`uses: ["dock"]`) and access state via `useModuleState("dock")` or `definePeer("dock", inert)`.

### Rule 2: Public Subpath Import Contract
All code imported by consumer applications must resolve through defined subpaths. Deep internal paths are strictly prohibited.
- ❌ `import { RegistryStore } from "@omerdlw/base-framework/kernel/registry-store"`
- ✅ `import { usePage, defineModule } from "@omerdlw/base-framework/kernel"`

### Rule 3: Server-Safe Foundation Purity
The foundation entries (`@omerdlw/base-framework/utils`, `tokens`, `result`, `events`) must never import React, hooks, or browser-specific window globals at module scope.
- ❌ `import { useState } from "react"` inside `src/utils/`
- ✅ Keep utility functions pure, deterministic, and testable without a DOM.

### Rule 4: Motion Token Singularity
Never hardcode inline animation durations (`duration: 0.3`) or custom bezier curves inside UI components. Use universal tokens from `@omerdlw/base-framework/tokens`.
- ❌ `<motion.div transition={{ duration: 0.35, ease: "easeInOut" }} />`
- ✅ `<motion.div transition={SPRING_PRESETS.GENTLE} />` or `transition={{ duration: DURATION_TOKENS.FAST, ease: EASING_CURVES.OUT_QUART }}`

### Rule 5: Z-Index Token Contract
Never use arbitrary stacking classes like `z-50`, `z-[99]`, or `z-[9999]`.
- ❌ `<div className="fixed inset-0 z-50 bg-black/80">`
- ✅ `<div className="fixed inset-0 bg-black/80" style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}>`

### Rule 6: Result Pattern for Operations
Asynchronous workflows, Server Actions, and data mutations must never throw unhandled errors across execution boundaries. Always return `Result<T, E>` using `ok(data)` and `err(message)` from `@omerdlw/base-framework/result`.
- ❌ `if (!id) throw new Error("Invalid ID");`
- ✅ `if (!id) return err("Invalid ID"); return ok({ success: true });`

### Rule 7: Declarative Chrome (`usePage`)
Consumer applications must never handcraft ad-hoc fixed headers, floating toolbars, or sticky navigation bars in individual page views. All route chrome is declared through `usePage()`:
- ❌ Building custom `<header className="fixed top-0...">` inside every page.
- ✅ `const page = usePage({ title: "Settings", dock: { description: "User settings", icon: "solar:settings-bold" } });`

### Rule 8: Event Bus Decoupling
Cross-cutting state notifications, external data updates, or global triggers must pass through `@omerdlw/base-framework/events` (`globalEvents`). Components must not couple directly to external transport implementations.
- ❌ Hardcoding direct listeners across isolated feature boundaries.
- ✅ `globalEvents.publish(EVENT_TYPES.STATE_CHANGE, { key, value });` and listen via `useGlobalEvent()`.

### Rule 9: Theme Decoupling
First-party modules must contain zero locked-in visual styling classes or hardcoded Tailwind colors. All visual design is expressed through theme slots (`defineThemeSpec`) and supplied by the consumer application via `ThemeProvider`.
- ❌ Hardcoding `bg-neutral-900 border-neutral-800` directly in module overlay markup.
- ✅ `className={theme.slots.card}` where `theme = useTheme(dockTheme)`.

### Rule 10: Pre-Flight Verification
Never consider any modification to the package or consumer code complete without running the full verification pipeline:
```bash
npm run type-check && npm run lint && npm run check:architecture && npm test && npm run build
```
All checks must exit with code `0`.

---

## 4. Enforcement Mechanisms

| Tool | Command | Scope Enforced |
| :--- | :--- | :--- |
| **TypeScript** | `npm run type-check` | Strict compiler type verification across all source files and test suites. |
| **ESLint** | `npm run lint` | Subpath boundary checks, no deep imports, no `any` without comment, motion rules. |
| **Architecture Script** | `npm run check:architecture` | Validates 0 import cycles across all files, validates module `uses` declarations. |
| **Node Test Runner** | `npm test` | 520+ tests asserting kernel lifecycles, module state machines, token correctness, and atom accessibility. |
| **tsup Bundler** | `npm run build` | Validates tree-shakable ESM packaging and `.d.ts` declaration generation. |

---

## 5. Decision Tree: Where Does Code Go?

```
What are you adding?
├─ Reusable unstyled UI atom (Button, Icon, Spinner, Tooltip) -> src/atoms/
├─ First-party UI module (Dock, Modal, Ambient, Toast)   -> src/modules/<module>/
├─ Universal React hook (useStore, useClickOutside)       -> src/hooks/
├─ Design token (motion preset, z-index layer)           -> src/tokens/
├─ Orchestration logic (registry, provider nesting)      -> src/kernel/
├─ Pure utility or data store (scheduler, store, clamp)   -> src/utils/
└─ Error handling & reporting (reporter, boundary)       -> src/error/
```
