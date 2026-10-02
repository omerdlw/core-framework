# Base Framework — System Architecture & Documentation Map

> **Microkernel orchestration engine and first-party declarative UI modules for app-like Next.js 16 (App Router) & React 19 web applications.**  
> Package: [`@omerdlw/base-framework`](https://www.npmjs.com/package/@omerdlw/base-framework)  
> Version: `1.0.0` • License: `MIT`

---

## 1. The System in One Page

```
Consumer Next.js App (app/, layout.tsx, page.tsx)
  │ usePage({ dock, modal, background, ... })
  ▼
@omerdlw/base-framework/kernel (Microkernel Engine: ModuleHost, RegistryStore, Context Registry)
  │
  ├─ Topologically sorts modules according to declared dependencies (`uses: [...]`)
  ├─ Nests module context providers in deterministic order
  ├─ Renders Backdrops behind children and Overlays above children in isolated error boundaries
  └─ Reconciles route visual chrome atomically on navigation
  │
  ▼
First-Party Declarative UI Modules:
  ├─ @omerdlw/base-framework/modules/dock          (Floating app chrome, cards, surfaces, flows, HUD, navigation guards)
  ├─ @omerdlw/base-framework/modules/modal         (Promise-based stacked dialogs, focus trap, smooth scroll lock)
  ├─ @omerdlw/base-framework/modules/notification  (Toast notifications, toast.promise, toast.fromResult)
  ├─ @omerdlw/base-framework/modules/ambient       (Media color extraction & dynamic canvas lighting)
  ├─ @omerdlw/base-framework/modules/background    (Multi-layer video, YouTube loop proxy, edge fades)
  ├─ @omerdlw/base-framework/modules/controls      (Paired HUD action rails flanking the dock)
  ├─ @omerdlw/base-framework/modules/loading       (Coordinated loading overlay, skeleton sync, anti-flicker delay)
  ├─ @omerdlw/base-framework/modules/media         (Unified media playback session, transport leader vs displacement)
  └─ @omerdlw/base-framework/modules/context-menu  (Viewport-clamped right-click context menus)

Foundational Libraries & Primitives:
  ├─ @omerdlw/base-framework/theme     (Theme engine: defineThemeSpec, defineTheme, ThemeProvider, useTheme)
  ├─ @omerdlw/base-framework/result    (Functional Result<T, E> error handling: ok, err, createSafeAction)
  ├─ @omerdlw/base-framework/events    (Cross-cutting decoupled event bus: globalEvents, EVENT_TYPES)
  ├─ @omerdlw/base-framework/atoms     (Unstyled accessible UI atoms: Button, Icon, Spinner, Tooltip)
  ├─ @omerdlw/base-framework/tokens    (Hardware GPU motion presets, easing curves, Z-index hierarchy)
  ├─ @omerdlw/base-framework/hooks     (useStore, useGlobalEvent, useClickOutside, useRequiredContext)
  ├─ @omerdlw/base-framework/utils     (cn, clamp, debounce, throttle, createStore, createScheduler, report)
  └─ @omerdlw/base-framework/error     (GlobalError, ModuleError, UserError, toUserMessage)
```

---

## 2. Documentation Map

Whether you are a software architect or an AI Pair Programmer (Antigravity, Cursor, Claude Code), consult these guides for comprehensive reference:

### 2.1 General Architecture Guides

| Document | Primary Audience | Scope & Contents |
| :--- | :--- | :--- |
| **[`getting-started.md`](./getting-started.md)** | All Developers | Step-by-step Next.js 16 installation, Tailwind CSS v4 `@source` configuration, and root layout setup. |
| **[`architecture-and-rules.md`](./architecture-and-rules.md)** | Architects & Agents | The package layer hierarchy, 10 inviolable rules, import boundaries, decision tree, anti-patterns. |
| **[`theming.md`](./theming.md)** | Designers & Developers | Visual customization guide: `defineThemeSpec()`, `defineTheme()`, `<ThemeProvider>`, and slot reference. |
| **[`custom-modules.md`](./custom-modules.md)** | Advanced Developers | Authoring custom modules via `defineModule()`, topological dependencies, and `usePage()` augmentation. |
| **[`core-engine.md`](./core-engine.md)** | Developers & Agents | `CoreProvider`, Theme engine, Event bus, Motion & Z-index tokens, Pure utils, scheduler, and reactive stores. |
| **[`testing.md`](./testing.md)** | Developers & QA | Running the 520+ test suite, `happy-dom` harness (`renderHook`, `Themed`), and downstream component testing. |
| **[`templates/AGENTS.md`](../templates/AGENTS.md)** | AI Agents & Tech Leads | **Drop-in instructions** for AI coding assistants in projects using `@omerdlw/base-framework`. |

### 2.2 Module Reference — [`modules/`](./modules/README.md)

| Page | What it covers |
| :--- | :--- |
| **[`kernel.md`](./modules/kernel.md)** | `usePage()`, `defineModule()`, transactional registry (sources, priority, lifecycles), topological sorting, peers. |
| **[`dock.md`](./modules/dock.md)** | The framework chrome: cards, surfaces/steps/flows, HUD, operations, status overlays, guards, navigation, theming. |
| **[`modal.md`](./modules/modal.md)** | Promise-based stacked dialogs, positions, chromes, focus trap, smooth scroll lock. |
| **[`notification.md`](./modules/notification.md)** | Toast notifications (`useToast`), `toast.promise`, `toast.fromResult`, error boundary bridging, auto 401 listener. |
| **[`loading.md`](./modules/loading.md)** | Loading overlay, skeleton synchronization, anti-flicker delay, `withLoading` wrapper. |
| **[`background.md`](./modules/background.md)** | Image / video / YouTube loop backgrounds, cross-fades, edge fades, YouTube stream proxy. |
| **[`media.md`](./modules/media.md)** | The unified media transport session behind dock controls; playback leader vs audible displacement. |
| **[`ambient.md`](./modules/ambient.md)** | Media color extraction → OKLCH dynamic canvas illumination. |
| **[`controls.md`](./modules/controls.md)** | Paired control rails beside the dock, hotkeys, page controls. |
| **[`context-menu.md`](./modules/context-menu.md)** | Declarative right-click menus, viewport clamping, accessibility, hotkey triggers. |
| **[`error-boundary.md`](./modules/error-boundary.md)** | Hierarchical boundaries, diagnostic `report()` sink, deduplicating reporter, user-safe messages. |
| **[`result.md`](./modules/result.md)** | Functional `Result<T, E>` pattern, `ok()`, `err()`, safe server actions. |

---

## 3. Find It Fast (by Task)

| I want to… | Read |
| :--- | :--- |
| Install and set up the package in a Next.js App | [`getting-started.md`](./getting-started.md) |
| Add a page with a title, icon, and background | [`getting-started.md §5`](./getting-started.md#5-building-your-first-route-with-usepage) → [`dock.md §3`](./modules/dock.md#3-quick-start) |
| Restyle a module with custom Tailwind classes | [`theming.md`](./theming.md) |
| Build an interactive onboarding tour or custom module | [`custom-modules.md`](./custom-modules.md) |
| Open a multi-step sheet/wizard and await result | [`dock.md §8`](./modules/dock.md#8-surfaces) |
| Confirm an action with a modal dialog | [`modal.md`](./modules/modal.md) |
| Show "Saved" toast or handle Server Action feedback | [`notification.md`](./modules/notification.md), [`result.md`](./modules/result.md) |
| Block navigation when leaving a dirty form | [`dock.md §12`](./modules/dock.md#12-navigation-guards-and-transactions) |
| Display progress for a long background operation | [`dock.md §9.4`](./modules/dock.md#94-operations) |
| Play audio synchronized to background media | [`media.md`](./modules/media.md) |
| Dynamically tint the canvas based on an image | [`ambient.md`](./modules/ambient.md) |
| Add action buttons beside the floating dock | [`controls.md`](./modules/controls.md) |
| Attach a contextual right-click menu | [`context-menu.md`](./modules/context-menu.md) |
| Animate an element with hardware GPU acceleration | [`core-engine.md §6`](./core-engine.md#6-motion--design-tokens-omerdlwbase-frameworktokens), [Rule 4](./architecture-and-rules.md#rule-4-motion-token-singularity) |
| Write a robust, type-safe Server Action | [`result.md`](./modules/result.md) |
| Run tests or write a new unit/integration test | [`testing.md`](./testing.md) |
| Resolve an architecture or lint boundary failure | [`architecture-and-rules.md §4`](./architecture-and-rules.md#4-enforcement-mechanisms) |

---

## 4. Working in the Codebase

1. **Before writing code:** Read [`architecture-and-rules.md`](./architecture-and-rules.md) for import restrictions and the 10 inviolable rules, plus the module guide for any unit you touch.
2. **Finding your way:** Each module guide opens with an *At a Glance* table and ends with a *File Map*; use them instead of grepping whole directories.
3. **Modifying a module:** Update its documentation in the same commit (documentation is treated as code).
4. **Before committing:** Run the pre-flight suite:
   ```bash
   npm run type-check && npm run lint && npm run check:architecture && npm test && npm run build
   ```
   All checks must exit `0`.

---

## 5. Conventions Used in These Docs

- Package imports use `@omerdlw/base-framework/*` (e.g., `@omerdlw/base-framework/kernel`, `@omerdlw/base-framework/modules/dock`).
- "Page API" refers to `usePage(...).modules.<id>`; "peer" refers to a module consumed via `definePeer` / `useModuleState`.
- Configuration tables list **defaults**; if a default is not stated, the option is optional and defaults to undefined.
- When documentation and source code disagree, **the code wins** — fix the documentation immediately.
