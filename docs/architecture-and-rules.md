# Architecture, Boundaries & The 10 Inviolable Rules

> **Read this first if you are about to:** contribute to `@omerdlw/base-framework`, author or modify a module, structure downstream application code that consumes the package, or understand how the layers are enforced.

---

## 1. The Package Architecture Hierarchy

The source is split into four layers. A file's layer is its first folder under `src/`:

| Layer | Folder           | Contents                                                                           | Public subpaths                                                                      |
| :---- | :--------------- | :--------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| 0     | `src/foundation` | No React, server and edge safe: `result`, `events`, `utils`, `recipes`             | `/result`, `/events`, `/utils`, `/recipes`                                           |
| 1     | `src/react`      | React primitives: `context`, `hooks`, `theme`, `ui` (components and `UiProvider`)  | `/hooks`, `/theme`, `/ui`                                                            |
| 2     | `src/core`       | Orchestration: `kernel`, `error`, `provider`, `navigation` (the navigator machine) | `/kernel`, `/error`, `/provider`                                                     |
| 3     | `src/modules`    | The UI modules and `modules/index.ts` (`defaultModules`)                           | `/modules`, `/<module>` (`/dock`, `/modal`, …), `/ambient/server`, `/ambient/worker` |

`src/index.ts` and `src/modules/index.ts` are barrels and may import from any layer.

### 1.1 Layer Invariants

1. **Downwards only:** a file imports from its own layer or a lower one, never a higher one. Type-only imports count too.
2. **Server-safe foundation:** `src/foundation/**` never imports `react`, `react-dom`, `next/*` or `motion/*`, and never touches `window` or `document` at module scope. `/result`, `/events`, `/utils` and `/recipes` are safe in Server Components, Route Handlers, Server Actions and Edge functions.
3. **Module isolation:** a module imports another module only through that module's public barrel (`@/modules/<name>`), and only when `<name>` is in its `uses`. Deep imports into another module's files are errors (Rule 1).
4. **No deep imports for consumers:** apps import only the subpaths in `package.json#exports` (`@omerdlw/base-framework/kernel`, `@omerdlw/base-framework/dock`). File paths such as `@omerdlw/base-framework/dist/kernel/page.js` are not part of the API.
5. **Zero cycles:** the import graph has no cycles, verified by `npm run check:architecture`.
6. **Inside a layer:** imports point straight at the file (`@/core/kernel/registry/hooks`). A folder's `index.ts` is a public entry only; internal code does not import through it.

---

## 2. Canonical Module File Pattern

Code is grouped by what it does, not by what kind of file it is. A reader looking for the dock's breadcrumbs opens `dock/routing/`, not `components/`, `hooks/` and `model/` in turn. Two layouts follow from that rule.

### 2.1 Flat layout (default)

Used by `ambient`, `background`, `context-menu`, `controls`, `loading`, `media`, `modal`, `navigation` and `notification`.

| File           | Responsibility                                                                              | Required? |
| :------------- | :------------------------------------------------------------------------------------------ | :-------: |
| `index.ts`     | Public barrel with named exports.                                                           |    ✅     |
| `module.tsx`   | `defineModule()` and `declare module` augmentations.                                        |    ✅     |
| `types.ts`     | Type contracts, no runtime code.                                                            |    ✅     |
| `constants.ts` | Module id, `defineThemeSpec`, constants.                                                    |    ✅     |
| `context.tsx`  | Context and provider; at most one context per module.                                       | Optional  |
| `state.ts`     | Initial state and pure reducers.                                                            | Optional  |
| `hooks.ts`     | Public hooks and view-model hooks (`use<Component>Model`).                                  | Optional  |
| `overlay.tsx`  | Visual JSX that consumes the view-models; no state, effects or refs.                        | Optional  |
| `motion.ts`    | The module's `use*Motion()` hook. Motion values live in the app's theme, not in the module. | Optional  |
| `utils.ts`     | Pure helpers.                                                                               | Optional  |

A module adds topic files for a cohesive concern (`context-menu/resolver.ts`, `media/session.ts`, `modal/layout.ts`) and a folder for a self-contained part (`ambient/analysis/`, `background/youtube/`). Ambient's `server/` and `worker/` sub-entries stay in place.

### 2.2 Feature layout

A module too large for one flat folder splits by feature. Today that is `dock`:

```
modules/dock/
├── index.ts  module.tsx  constants.ts  context.ts  provider.tsx
├── hooks.ts  theme.ts  motion.ts  utils.ts
├── types/      contracts split by area, plus index.ts
├── stack/      the dock root, layout, height and focus
├── card/       a card and its parts
├── commands/   …one folder per feature
└── surface/    with surface/runtime/ for the surface stack
```

Inside a feature folder, a component and the view-model hook only it uses share a file when together they stay readable (`surface/shell.tsx`); otherwise they sit side by side (`card/card.tsx` and `card/use-card.ts`). Files are named for what they hold, without repeating the folder (`card/header.tsx`, not `card/card-header.tsx`).

### 2.3 Size and naming

- File and folder names are kebab-case; hook files start with `use-`.
- A name prefix shared by several files (`store-*.ts`) means they belong in a folder (`registry/`).
- A file under about 40 lines joins its only user or its closest sibling instead of standing alone.
- No file under `src/` exceeds 500 lines; `npm run check:architecture` enforces it.

---

## 3. The 10 Inviolable Rules

### Rule 1: Modules Meet Only at Public Barrels

A module never reaches into another module's files. When it needs another module, it imports that module's public barrel and declares it in `uses`, so the coupling is explicit and checked, like a package dependency. Looser needs go through `useModuleState()`, `definePeer()` or `globalEvents`.

- ❌ `import { createNavigator } from "../navigation/navigator"` inside `src/modules/dock/`
- ❌ `import { useNavigation } from "@/modules/navigation"` without `uses: ["navigation"]`
- ✅ `uses: ["navigation"]` in `module.tsx`, then `import { … } from "@/modules/navigation"`
- ✅ `useModuleState("dock")` or `definePeer("dock", inert)` when the peer may be absent

### Rule 2: Public Subpath Import Contract

All code imported by consumer applications must resolve through defined subpaths. Deep internal paths are strictly prohibited.

- ❌ `import { RegistryStore } from "@omerdlw/base-framework/kernel/registry-store"`
- ✅ `import { usePage, defineModule } from "@omerdlw/base-framework/kernel"`

### Rule 3: Server-Safe Foundation Purity

The foundation (`src/foundation`, published as `/utils`, `/recipes`, `/result`, `/events`) never imports React, Next.js or motion, and never touches browser globals at module scope.

- ❌ `import { useState } from "react"` inside `src/foundation/utils/`
- ✅ Keep foundation functions pure, deterministic and testable without a DOM.

### Rule 4: Motion Token Singularity

Never hardcode inline animation durations (`duration: 0.3`) or custom bezier curves inside UI components. In an app, take them from your own motion tokens (`defineMotion`, [theming §5](./theming.md#5-motion-your-app-owns-every-animation)). In a first-party module, take them from the app: a module declares a motion contract and reads it with `useModuleMotion(spec)`, never shipping values of its own.

- ❌ `<motion.div transition={{ duration: 0.35, ease: "easeInOut" }} />`
- ✅ `<motion.div transition={{ duration: motion.durations.fast, ease: motion.easings.enter }} />` in app code
- ✅ `<motion.div variants={dockMotion.variants.fade} />` in a module (`const dockMotion = useDockMotion()`)

### Rule 5: Stacking Belongs to the App

The framework holds no z-index ladder. A module takes its layer from the theme's `styles`; a component from its recipe. Keep the app's layers in one constant and refer to it.

- ❌ `style={{ zIndex: 140 }}` inside framework code
- ✅ `defineTheme(modalTheme, { slots, styles: { layer: { zIndex: LAYERS.MODAL } } })` in the app

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

Never consider a change to the package complete without running the full pipeline:

```bash
npm run verify
```

It runs `format:check`, `lint`, `type-check`, `check:architecture`, `test`, `build` and `test:dist`, and must exit with code `0`.

---

## 4. Enforcement Mechanisms

| Tool                    | Command                      | Scope enforced                                                                                                                                                                      |
| :---------------------- | :--------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prettier**            | `npm run format:check`       | One formatting for source, tests and docs.                                                                                                                                          |
| **ESLint**              | `npm run lint`               | Type-aware rules, import order, public subpaths only, the React Compiler rules (`react-hooks/*` as errors).                                                                         |
| **TypeScript**          | `npm run type-check`         | Strict types for `src`, `templates` and `tests/types`.                                                                                                                              |
| **Architecture script** | `npm run check:architecture` | Four rules: no import cycles; layers only import downwards and foundation stays framework-free; modules meet only at declared public barrels (`uses`); files stay within 500 lines. |
| **Node test runner**    | `npm test`                   | The test suite over foundation, react, core and modules, run on the uncompiled source.                                                                                              |
| **tsup + smoke tests**  | `npm run build`, `test:dist` | ESM bundles with the React Compiler, `.d.ts` output, and 13 smoke tests against `dist`.                                                                                             |

---

## 5. Decision Tree: Where Does Code Go?

```
What are you adding?
├─ Pure helper, store or scheduler (clamp, createStore)       -> src/foundation/utils/
├─ Result type or event bus addition                          -> src/foundation/result/, src/foundation/events/
├─ Recipe, anatomy or class helper (defineUi, cn)             -> src/foundation/recipes/
├─ Universal React hook (useStore, useClickOutside)           -> src/react/hooks/
├─ Theme or motion plumbing (defineTheme, useModuleMotion)    -> src/react/theme/
├─ Reusable component (Button, Icon, Select, Carousel)        -> src/react/ui/components/
├─ Orchestration (registry, page controller, provider)        -> src/core/kernel/, src/core/provider/
├─ Error handling and reporting (boundary, listener)          -> src/core/error/
├─ Navigation machine shared by modules                       -> src/core/navigation/
└─ First-party UI module (Dock, Modal, Ambient, Toast)        -> src/modules/<module>/
```

## 6. React Compiler and Memoization

Client entries are built with `babel-plugin-react-compiler` (infer mode). The build prints `React Compiler (client entries): N compiled, M skipped` and lists every skip.

Code must behave the same with and without the compiler: tests, SSR and consumers who bundle the source run it uncompiled. A value that reaches an effect dependency, a render-phase comparison, a `useSyncExternalStore` subscribe, a context value or a public hook return needs a stable source without the compiler (a module constant, a lazy `useState` factory, or a kept memo). Every kept `useMemo`/`useCallback` carries a reason comment, for example:

- `// stable identity: consumers subscribe by reference` (context values)
- `// stable identity: part of the public hook contract` (public hook returns)

Memos that only feed render output or DOM event handlers are dropped.

### Compiler exceptions

These functions are skipped by the compiler on purpose. Their memos stay hand-written and are marked `// kept: <fn> is a compiler exception`.

| File                                           | Function                          | Reason                                                                                                                  |
| :--------------------------------------------- | :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| `src/core/kernel/registry/hooks.ts`            | `useShallowStable`                | Reads and writes a ref during render to keep a shallow-equal value stable; a state-based version costs an extra render. |
| `src/core/kernel/page.tsx`                     | `useModuleControllers`            | Calls each module's `page.use` hook in a loop; compiled, the loop is memoized and the hooks are skipped on re-render.   |
| `src/modules/ambient/hooks.ts`                 | `useStableObject`                 | Same ref-during-render pattern as `useShallowStable`.                                                                   |
| `src/modules/background/youtube/use-player.ts` | `useYouTubeBackgroundPlayerModel` | Writes the latest props into `live.current` during render for imperative player callbacks.                              |
| `src/modules/dock/items/operations.ts`         | `useDockOperationState`           | Reads the operations ref during render.                                                                                 |

Refactoring any of these is optional work; when one compiles, re-check its memos against the rule above.
