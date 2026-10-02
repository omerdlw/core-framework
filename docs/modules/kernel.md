# Kernel — `@omerdlw/base-framework/kernel`

> **Read this first if you need to:** register something for the current page (`usePage`), understand how modules install and find each other, write your own module, or debug why a registration did or did not win.

## 1. At a glance

|                      |                                                                                                                       |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **Import**           | `import { usePage, defineModule, definePeer, useModule, … } from "@omerdlw/base-framework/kernel"`                                     |
| **Layer**            | `src/core` (frozen upstream). Knows **no module by name**; never imports `@omerdlw/base-framework/modules/**`, `@/features/**`, `@/app/**`. |
| **Mounted by**       | `CoreProvider` (`src/core/provider.tsx`) → `ModuleHost`                                                               |
| **State**            | A scoped, subscribable **registry** (`createRegistryStore`) and a **page controller stack**                           |
| **Extension points** | `defineModule({...})`, module augmentation of `CoreModules`, `PageConfig`, `RegistrySchema`                           |
| **Tests**            | `tests/core/kernel.test.ts`                                                                                           |

## 2. Mental model

```
CoreProvider
 └─ GlobalError ─ Tooltip ─ ModuleHost ───────────────────────────────────────────────┐
     │  1. sortModules(modules)           ← dependency order from `uses`, validates ids │
     │  2. RegistryProvider               ← one registry; types come from module `registry` definitions
     │  3. ModuleHost context             ← id → module map, boundary component
     │  4. PageControllerProvider         ← the stack of mounted usePage() controllers
     │  5. providers nested (module N inside the modules it `uses`)
     │  6. <Backdrop/> per module → {children} → <Overlay/> per module   (each in an error boundary)
     └────────────────────────────────────────────────────────────────────────────────┘

usePage(config)
  for every installed module:  page.select(config)  →  slice
                               page.entries(slice)  →  registry entries   (applied in ONE batch)
                               page.use(slice, {set}) → page.modules[id]  (the module's page API)
```

Three pieces:

1. **Modules** — self-describing units (`defineModule`). They reach each other only through `useModule` / `useModuleState` / `definePeer`, never by importing.
2. **The registry** — a key/value store per module type. Several _sources_ can register the same key; the kernel picks (or merges) the winner and cleans up per lifecycle.
3. **Pages** — `usePage(config)` turns one object into every module's registrations and page API. The kernel itself only owns `title`, `registry`, `set` and `reset`.

## 3. Quick start

```tsx
"use client";
import { usePage } from "@omerdlw/base-framework/kernel";

export function DashboardClient() {
  const page = usePage({
    title: "Dashboard", // kernel: also the dock title fallback
    dock: { description: "Overview", icon: "solar:chart-2-bold" },
    background: { image: "/images/dashboard.jpg", overlay: true },
    loading: isFetching,
    contextMenu: {
      items: [{ key: "refresh", label: "Refresh", onSelect: refetch }],
    },
  });

  return (
    <Button onClick={() => page.modules.notification?.toast("Saved")}>
      Save
    </Button>
  );
}
```

```ts
// Static route metadata: src/app/registry.tsx (registry type = module id)
export const APP_REGISTRY_ENTRIES = [
  {
    type: "dock",
    items: { "/": { title: "Home", icon: "solar:home-2-bold", path: "/" } },
  },
];
```

## 4. `usePage`

```ts
const page = usePage(config?: PageConfig, options?: PageOptions): PageController
```

| `PageController` member | Meaning                                                                                                                                                                                                                          |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config`                | The effective config (your object merged with runtime `set` overrides).                                                                                                                                                          |
| `modules`               | Each module's **page API** (`page.modules.dock`, `.background`, `.notification` …). Present only when the module is installed **and** defines `page.use`. Always use optional chaining: `page.modules.notification?.toast(...)`. |
| `set(partial)`          | Shallow-merge runtime overrides into the config (objects one level deep). Modules expose typed wrappers (`page.modules.dock.set({...})`).                                                                                        |
| `reset()`               | Drop all runtime overrides.                                                                                                                                                                                                      |
| `Provider`              | A component that scopes this controller to a subtree (`usePageController()` inside it returns _this_ controller).                                                                                                                |

`PageConfig` always has `title?` and `registry?`; every module **augments** it (`dock?`, `background?`, `loading?`, `modal?`, `controls?`, `contextMenu?`, `ambient?`, `media?`, `notification?`).

`PageOptions` (second argument): registry metadata applied to **all** the page's registrations (`priority`, `source`, `lifecycle`, `scope`, `instanceId`, …). A module slice can override it per item with its own `registry` key.

### 4.1 What happens on each render

1. `config` + runtime overrides → `effectiveConfig`.
2. Every module's `page.select` computes its slice; `createModulePayload` keeps modules that have `page.entries` and a non-null slice.
3. **Stabilization.** The payload is walked and (a) object/array identity is reused when nothing changed, (b) function values (arrow functions, handlers) are replaced by **stable proxies** that always call the latest function, and (c) React elements are cloned with stabilized props. Result: inline `onClick`/`items: () => …` do **not** cause re-registration on every render. Functions whose name starts with a capital letter (components) and direct component values of `valueKind: "component"` types are passed through by identity.
4. `applyRegistryConfig` validates (`definition.validate`), then registers every entry in **one batch**; the cleanup runs when the payload changes or the component unmounts.
5. Each module's `page.use(slice, { set })` runs (it is a hook, so it must not be conditional) and the results become `page.modules`.

### 4.2 Rules

- Call `usePage` once per page component (or layout) at the top level. It is a hook; do not call it conditionally.
- `usePageController()` is the read-only variant: it returns the active controller without registering anything (used by chrome that needs the current page).
- Server components cannot call it: put it in a `"use client"` component.

## 5. Registry

### 5.1 Type definitions (`RegistryDefinition`, on `defineModule({ registry })`)

| Field                          | Meaning                                                                                                                                                           |
| :----------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keyPolicy`                    | `"singleton"` (one fixed `singletonKey`), `"named"` (any non-empty string), `"path"` (must start with `/`), `"route"` (a `/…` path **or** one of `reservedKeys`). |
| `lifecycle`                    | Default lifecycle (below).                                                                                                                                        |
| `cleanupDelayMs`               | Default delay for delayed cleanup.                                                                                                                                |
| `valueKind`                    | `"object"` (default: values must be plain objects) or `"component"` (functions or component objects).                                                             |
| `merge(valuesLowToHigh)`       | Combine several sources instead of picking one (dock merges card fields and styles).                                                                              |
| `validate(value)`              | Return `{ valid, issues }`; invalid values are skipped with a warning (`strict` mode also validates metadata).                                                    |
| `reservedKeys`, `singletonKey` | See key policies.                                                                                                                                                 |

### 5.2 Who wins

For one `(type, key)` every registration is a **record** with `source`, `priority`, and a sequence number. Records are ordered by:

1. `priority` — explicit number, otherwise derived from the source (`static` 100, `dynamic` 200, `user` 300);
2. source rank (`static` < `dynamic` < `user`);
3. recency (the later registration wins ties).

The highest record is the value, **or** `definition.merge` receives all values from lowest to highest (only when all are plain objects).

| Source    | Typical use                                          |
| :-------- | :--------------------------------------------------- |
| `static`  | `src/app/registry.tsx` initial entries.              |
| `dynamic` | **Default** for `usePage` / `useModuleRegistration`. |
| `user`    | User-driven overrides. Pass `{ source: "user" }`.    |

`REGISTRY_SOURCES` exposes the vocabulary.

### 5.3 Lifecycles

| Lifecycle           | Cleanup when the registering page/component goes away                                                                                                   |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `immediate`         | Entry removed in the same batch (forces a delay of 0 even if the type declares one).                                                                    |
| `graceful`, `route` | Removed after `cleanupDelayMs` (from options or the type definition) — so route transitions do not flicker. With no delay they behave like `immediate`. |
| `persistent`        | Never removed by the page; use `unregister`.                                                                                                            |

A pending cleanup is **cancelled** if the same entry is re-registered before the timer fires.

### 5.4 Metadata keys (`RegistryMetadata`)

`lifecycle` (or `cleanup`), `cleanupDelayMs`, `priority`, `source`, `scope`, `instanceId`, `validation` (`"warn"` default or `"strict"`). Anything else is reported by `validateRegistryMetadata`. `scope` partitions entries (default `"app"`); `instanceId` is stamped by the kernel so a component only unregisters its own entries.

### 5.5 Reading the registry

| Hook                          | Returns                                                          |
| :---------------------------- | :--------------------------------------------------------------- |
| `useRegistryValue(type, key)` | The resolved value of one key (re-renders only when it changes). |
| `useRegistryEntries(type)`    | `Record<key, value>` of every key of a type.                     |

The store also supports `register` / `unregister` / `batch` / `transaction` (atomic multi-entry change with a trace id) through `createRegistryStore`; most code never calls them directly (`usePage` and `useModuleRegistration` do).

## 6. Modules

### 6.1 `defineModule`

```ts
export const myModule = defineModule({
  id: "announcement",                 // camelCase: /^[a-z][a-zA-Z0-9]*$/ ("contextMenu", not "context-menu")
  context: MyContext,                 // React context carrying { actions, store } (ModuleRuntime)
  Provider: MyProvider,               // wraps the app (nested after the modules it `uses`)
  Backdrop: MyBackdrop,               // rendered BEFORE children (behind the page)
  Overlay: MyOverlay,                 // rendered AFTER children (above the page)
  uses: ["background"],               // optional peers (ordering + dev warning if missing)
  registry: { keyPolicy: "singleton", singletonKey: "current", lifecycle: "route" },
  page: {
    select: (config) => config.announcement,           // default: config[id]
    entries: (slice, { pathname }) => [{ key: "current", value: slice }],
    use: (slice, { set }) => ({ show: () => set({ announcement: {...} }) }),   // page.modules.announcement
  },
});

declare module "@omerdlw/base-framework/kernel" {
  interface CoreModules { announcement: typeof myModule }
  interface PageConfig { announcement?: AnnouncementConfig }
}
```

`defineModule` freezes and returns the definition. `ModuleHost` throws on **invalid ids**, **duplicate ids**, and **dependency cycles**; in development it warns when a `uses` peer is not installed. Every field except `id` is optional: a module can be only an overlay, only a registry type, only a provider.

### 6.2 Talking to other modules

| API                                                | Use                                                                                                                                                                                                            |
| :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useModule(id)`                                    | The module's runtime `{ actions, store }`, or `null` when not installed.                                                                                                                                       |
| `useModuleState(id, selector, fallback, isEqual?)` | A slice of another module's state; returns `fallback` when it is not installed. Only re-renders when the slice changes.                                                                                        |
| `definePeer(id, inert)`                            | A typed reader `{ useRuntime, useActions, useState }` that falls back to the `inert` stand-in when the module is missing. **List the id in `uses`.** This is the pattern the dock, background and ambient use. |
| `useIsModuleInstalled(id)`                         | Boolean.                                                                                                                                                                                                       |
| `ModuleBoundary`                                   | Wrap module UI in the host's error boundary (`name` is shown in the error UI).                                                                                                                                 |

Pass the module id to `useModule`, `useModuleState` and `definePeer` as a **string literal** (`definePeer("media", …)`) and list it in the module's `uses`: `npm run check:architecture` greps for both.

### 6.3 Install order and rendering

`sortModules` orders modules so that every module comes **after** the modules it `uses`; `ModuleHost` nests providers in that order (a later module's provider is _inside_ earlier ones, so it can read them). All **Backdrops** render first, then `children`, then all **Overlays**, each wrapped in the boundary passed to the host (`ModuleError` from `@omerdlw/base-framework/error` in `CoreProvider`).

### 6.4 Registering without `usePage`

`useModuleRegistration(id, value, { enabled?, ...metadata })` registers one module's slice (each module re-exports a named wrapper: `useDockRegistration`, `useBackgroundRegistration`, `useLoadingRegistration`, …). `enabled: false` or a `null` value removes it.

## 7. Public API

| Export                                                                                                                            | Kind                       | Description                                                                                                                                                                                                                                    |
| :-------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineModule(definition)`                                                                                                        | factory                    | Declare a module (§6.1).                                                                                                                                                                                                                       |
| `ModuleHost`, `ModuleBoundary`                                                                                                    | components                 | Install modules; wrap UI in the module error boundary.                                                                                                                                                                                         |
| `useModule`, `useModuleState`, `useIsModuleInstalled`, `definePeer`                                                               | hooks / factory            | Module-to-module access (§6.2).                                                                                                                                                                                                                |
| `useModuleRegistration`                                                                                                           | hook                       | Register one slice outside `usePage`.                                                                                                                                                                                                          |
| `usePage`, `usePageController`, `PageControllerProvider`                                                                          | hooks / provider           | Page registration and read access (§4).                                                                                                                                                                                                        |
| `RegistryProvider`, `useRegistryValue`, `useRegistryEntries`, `createRegistryStore`                                               | provider / hooks / factory | Registry access (§5).                                                                                                                                                                                                                          |
| `createRegistryOperations`, `createModuleRegistryDefinitions`, `sortModules`, `applyRegistryConfig`, `createRegistryApplyContext` | functions                  | Lower-level pieces (used by the host and by tests).                                                                                                                                                                                            |
| `Compose`, `ProviderEntry`                                                                                                        | component / type           | Nest providers from a list (`[Component, props]` tuples allowed).                                                                                                                                                                              |
| `REGISTRY_SOURCES`, `hasOwnProperty`                                                                                              | constants / util           |                                                                                                                                                                                                                                                |
| Types (`export * from "./types"`)                                                                                                 |                            | `CoreModule`, `CoreModules`, `ModuleId`, `ModuleRuntime`, `ModuleStateOf`, `PageConfig`, `PageController`, `PageModules`, `PageOptions`, `RegistryDefinition`, `RegistryMetadata`, `RegistrySchema`, `AppRegistryEntry`, `ValidationResult`, … |

## 8. Recipes and gotchas

| I want to…                                     | Do this                                                                                                                      |
| :--------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| Static page metadata for every route           | Add to `APP_REGISTRY_ENTRIES` in `src/app/registry.tsx`.                                                                     |
| Let a layout set a default that pages override | Register in the layout with `{ source: "static" }` (or a lower `priority`); pages use the default `dynamic`.                 |
| Install only some modules                      | `<CoreProvider modules={[dockModule, notificationModule]}>`. Modules that `use` a missing peer fall back to inert stand-ins. |
| Add my own module                              | Follow §6.1; export it, append it to `modules`, augment the kernel types. No edits to `src/core`.                            |
| Read a module's state without coupling         | `useModuleState("dock", s => s.expanded, false)`.                                                                            |

- `page.modules.x` is `undefined` for modules that are not installed or have no `page.use`: use `?.`.
- `ModuleHost` reads the `modules` list **once** (at mount). Changing the array later has no effect; decide the module set before rendering `CoreProvider`.
- A `useRegistryValue` read happens **after** the registering effect: the first render of the registering component sees `undefined`.
- `usePage` registrations are page-scoped: they disappear (per lifecycle) when the component unmounts, so call it in the component that owns the page.
- A module id is an identifier everywhere (registry type, `page.modules[id]`, `uses`): keep it camelCase and stable.

## 9. File map

| File                  | Responsibility                                                                                                       |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------- |
| `index.ts`            | Public barrel.                                                                                                       |
| `types.ts`            | Registry, module, page-config and controller contracts.                                                              |
| `constants.ts`        | Registry sources, source priority/rank, lifecycles, metadata keys, default scope.                                    |
| `utils.ts`            | Input and scope resolution, config merging (`mergeModuleConfigs`), small guards.                                     |
| `schema.ts`           | Key/value/metadata validation, metadata normalization (lifecycle → cleanup delay).                                   |
| `operations.ts`       | Pure registry state machine (`createRegistryOperations`): records, ordering, merge, resolution cache.                |
| `store.ts`            | `createRegistryStore`: subscriptions, snapshots, handles, `batch`, `transaction`.                                    |
| `runtime.ts`          | Transactions.                                                                                                        |
| `provider.tsx`        | `RegistryProvider`, `useRegistryValue`, `useRegistryEntries`, `useRegistryActions`.                                  |
| `handlers.ts`         | `applyRegistryConfig`: slices → entries in one batch, cleanup per lifecycle.                                         |
| `hooks.ts`            | `useRegistry` (select → stabilize → apply), `createRegistryApplyContext`, `useShallowStable`, config stabilization.  |
| `adapters.tsx`        | `useModuleRegistration`.                                                                                             |
| `installed.ts`        | Host context, `sortModules`, payload creation, registry definitions from modules.                                    |
| `module.tsx`          | `defineModule`, `ModuleHost`, `useModule`, `useModuleState`, `definePeer`, `ModuleBoundary`, `useIsModuleInstalled`. |
| `page-controller.tsx` | `usePage` (producer), `usePageController` (consumer), controller stack and scopes.                                   |
| `compose.ts`          | `Compose` and provider-entry helpers.                                                                                |

## 10. Dependencies

- **Uses:** `@omerdlw/base-framework/utils`, `@omerdlw/base-framework/hooks` only. It names no module and imports no upper layer.
- **Used by:** every module (`defineModule`, registry hooks, peers), `src/core/provider.tsx` (mounts `ModuleHost`), `src/app/registry.tsx` (initial entries), pages and features (`usePage`, `useModuleState`).
