# Module Reference

> **Read this first if you need to:** find which module does what, see how modules connect, add a new module, or learn the structure every module page follows.

One page per module/core entry. Each page answers, from the big picture down to the details: **what it is → mental model → quick start → capabilities → full API → behaviour → theming → recipes/gotchas → file map → dependencies**.

## 1. Index

| Module         | Import                                      | Doc                                      | What it owns                                                                                       | Page key (`usePage`) | Registry type |
| :------------- | :------------------------------------------ | :--------------------------------------- | :------------------------------------------------------------------------------------------------- | :------------------- | :------------ |
| Kernel         | `@omerdlw/base-framework/kernel`                             | [kernel.md](./kernel.md)                 | Module host, registry, `usePage`, `defineModule`, peers                                            | `title`, `registry`  | —             |
| Dock           | `@omerdlw/base-framework/modules/dock`                            | [dock.md](./dock.md)                     | The only chrome: card stack, surfaces/flows, HUD, operations, status overlays, guards, breadcrumbs | `dock`               | `dock`        |
| Modal          | `@omerdlw/base-framework/modules/modal`                           | [modal.md](./modal.md)                   | Promise-based stacked dialogs                                                                      | `modal`              | `modal`       |
| Notification   | `@omerdlw/base-framework/modules/notification`                    | [notification.md](./notification.md)     | Single-slot toasts docked to the dock; event-driven feedback                                       | `notification`       | —             |
| Loading        | `@omerdlw/base-framework/modules/loading`                         | [loading.md](./loading.md)               | Loading overlay + busy flag                                                                        | `loading`            | `loading`     |
| Background     | `@omerdlw/base-framework/modules/background`                      | [background.md](./background.md)         | Image / video / YouTube layer behind the page                                                      | `background`         | `background`  |
| Media          | `@omerdlw/base-framework/modules/media`                           | [media.md](./media.md)                   | The active media session the dock controls operate on                                              | `media`              | `media`       |
| Ambient        | `@omerdlw/base-framework/modules/ambient`                         | [ambient.md](./ambient.md)               | Image → palette → CSS color variables                                                              | `ambient`            | —             |
| Controls       | `@omerdlw/base-framework/modules/controls`                        | [controls.md](./controls.md)             | Paired control rails beside the dock                                                               | `controls`           | `controls`    |
| Context menu   | `@omerdlw/base-framework/modules/context-menu` (id `contextMenu`) | [context-menu.md](./context-menu.md)     | Declarative right-click menus                                                                      | `contextMenu`        | `contextMenu` |
| Error boundary | `@omerdlw/base-framework/error`                              | [error-boundary.md](./error-boundary.md) | Boundaries, reporter, window error listener                                                        | —                    | —             |
| Result         | `@omerdlw/base-framework/result`                             | [result.md](./result.md)                 | `Result<T, E>`, `createSafeAction`                                                                 | —                    | —             |

General guides: [../getting-started.md](../getting-started.md) (installation & setup), [../architecture-and-rules.md](../architecture-and-rules.md) (rules and boundaries), [../theming.md](../theming.md) (custom themes), [../custom-modules.md](../custom-modules.md) (custom module authoring), [../core-engine.md](../core-engine.md) (provider, theme, events, hooks, utils, tokens), [../testing.md](../testing.md) (testing guide).

## 2. How the modules connect

Modules never import each other. They connect through three channels only:

```
 ┌────────────┐  usePage({ dock, background, loading, … })    ┌──────────┐
 │ pages/     │ ───────────────────────────────────────────▶ │ registry │  (per module type)
 │ features   │                                               └────┬─────┘
 └─────┬──────┘                                                    │ useRegistryEntries / useRegistryValue
       │ globalEvents (DOCK_STATUS_SET, AUTH_*, APP_ERROR …)        ▼
       ▼                                                      each module's provider/overlay
 ┌────────────┐  definePeer / useModuleState (declared in `uses`)
 │  modules   │ ◀────────────────────────────────────────────▶ other modules' stores
 └────────────┘  DOM contracts: #dock-card-stack, data-controls-hidden, data-controls-anchor
```

| Reader → source               | How                      | Used for                                                                     |
| :---------------------------- | :----------------------- | :--------------------------------------------------------------------------- |
| dock → `loading`              | `definePeer`             | Page-loading flag; `stopLoading()` after navigation.                         |
| dock → `media`                | `definePeer`             | Play/pause icon, media controls.                                             |
| dock → `notification`         | `definePeer`             | Is a toast visible (breadcrumbs yield).                                      |
| background → `media`          | `definePeer`             | Registers the background video as source `background`.                       |
| ambient → `background`        | `useModuleState`         | Poster URL as the default tint image.                                        |
| context-menu → `dock`         | `useModuleState`         | Active card as the default menu header.                                      |
| notification, controls → dock | DOM id `dock-card-stack` | Portal target / rail anchor.                                                 |
| dock ← events                 | `globalEvents`           | `APP_ERROR`, `API_ERROR`, `DOCK_STATUS_SET`, `DOCK_GUARD`, `DOCK_NOT_FOUND`. |
| notification ← events         | `globalEvents`           | `API_UNAUTHORIZED`, `APP_ERROR`/`STATE_CHANGE` with `notify: true`.          |

Every `definePeer`/`useModuleState`/`useModule` call needs the **peer id as a string literal** and the id in the module's `uses` (`npm run check:architecture` verifies it). Each peer ships an inert stand-in, so any module can be left out of `CoreProvider modules` and the rest still works.

## 3. Install-time facts

- `src/modules/index.ts` exports every module and `defaultModules` (`background, ambient, dock, controls, contextMenu, loading, media, modal, notification`); it is the only place that lists them all. `src/app/providers.tsx` passes the list to `CoreProvider`.
- Install a subset to ship less: `modules={[dockModule, notificationModule, loadingModule]}`.
- Module ids are **camelCase** (`contextMenu`); the folder and theme id may be kebab-case (`context-menu`).
- A module is installable when it has a `module.tsx` (or `module.ts`) with `defineModule`; the order of the list does not matter (`uses` sorts it).

## 4. Canonical module template

Every folder in `src/modules/` uses the same **slots**. A slot that does not apply is omitted, never created empty. `tests/architecture.test.ts` fails when a required file or the module's doc page is missing, or when an unexpected file appears at the module root.

| File           |      Required       | Responsibility                                                                                                                  |
| :------------- | :-----------------: | :------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`     |         ✅          | Public barrel: named exports only; nothing internal leaks through it.                                                           |
| `types.ts`     |         ✅          | Public TypeScript contracts, **no runtime code** (a `types/` folder with an `index.ts` is also accepted).                       |
| `constants.ts` |         ✅          | Frozen configuration, enums, event names, the theme spec (`defineThemeSpec`).                                                   |
| `utils.ts`     |         ✅          | Pure helpers (no React state).                                                                                                  |
| `module.tsx`   | installable modules | `defineModule` definition, `defineX` builder, `declare module "@omerdlw/base-framework/kernel"` augmentation (`module.ts` when there is no JSX). |
| `context.tsx`  |    when stateful    | The context, the provider and the `useX` hooks (**one** context per module).                                                    |
| `hooks.ts`     |      optional       | Extra hooks, notably the `use<Component>Model` logic behind each overlay component.                                             |
| `state.ts`     |      optional       | State factory, initial state, pure reducers.                                                                                    |
| `overlay.tsx`  |      optional       | **All** visual components: JSX only, calling `use*Model` hooks (no state, effects or refs).                                     |
| `motion.ts`    |      optional       | Motion presets derived from `@omerdlw/base-framework/tokens`.                                                                                    |
| `store.ts`     |      optional       | A store file when warranted.                                                                                                    |

Rules of thumb:

- A module may add a **topic file or folder** for a cohesive concern, declared in the file-pattern test (`background/youtube/`, `context-menu/resolver.ts`, the dock's `routing/ runtime/ status/ surface/ cards.tsx hud.ts provider.tsx`). Files past ~500 lines go into a sub-folder.
- Relative imports may reach into the **same** module only. Cross-module needs go through peers or `globalEvents`.
- Barrels use explicit named exports (`export { a, b } from "./x"`), never `export *` from implementation files; `export type * from "./types"` is fine.
- **No design in code:** colors, sizes, radii and typography are theme slots (`src/config/<name>.module.theme.ts`); animation comes from `@omerdlw/base-framework/tokens` presets.

### 4.1 File matrix (current)

| Module       | `index types constants utils` |  `module`   |  `context`   | `hooks` | `state` | `overlay` | `motion` | Extras                                                                               |
| :----------- | :---------------------------: | :---------: | :----------: | :-----: | :-----: | :-------: | :------: | :----------------------------------------------------------------------------------- |
| ambient      |              ✅               |     ✅      |      ✅      |    —    |    —    |     —     |    —     |                                                                                      |
| background   |              ✅               |     ✅      |      ✅      |   ✅    |    —    |    ✅     |    ✅    | `youtube/`                                                                           |
| context-menu |              ✅               |     ✅      |      ✅      |   ✅    |   ✅    |    ✅     |    ✅    | `resolver.ts`                                                                        |
| controls     |              ✅               |     ✅      |      —       |   ✅    |    —    |    ✅     |    —     |                                                                                      |
| dock         |              ✅               |     ✅      | `context.ts` |   ✅    |   ✅    |    ✅     |    ✅    | `provider.tsx`, `cards.tsx`, `hud.ts`, `routing/`, `runtime/`, `status/`, `surface/` |
| loading      |              ✅               |     ✅      |      ✅      |   ✅    |    —    |    ✅     |    —     |                                                                                      |
| media        |              ✅               |     ✅      |      ✅      |   ✅    |    —    |    ✅     |    —     |                                                                                      |
| modal        |              ✅               |     ✅      |      ✅      |   ✅    |   ✅    |    ✅     |    ✅    |                                                                                      |
| notification |              ✅               | `module.ts` |      ✅      |   ✅    |    —    |    ✅     |    ✅    |                                                                                      |

### 4.2 Why some optional slots are absent

| Module         | Absent                  | Reason                                                                                                                                 |
| :------------- | :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `ambient`      | `overlay`, `motion`     | Renders nothing: it writes CSS custom properties; transitions are CSS classes from the theme.                                          |
| `controls`     | `context`, `motion`     | Stateless: entries live in the registry and layout is measured from the DOM. No animation.                                             |
| `loading`      | `motion`, `state`       | The overlay renders `Spinner` (or a skeleton) and mounts/unmounts instantly; state is a small `useState` in the provider.              |
| `media`        | `motion`                | Renders nothing; `overlay.tsx` holds only the components that return `null` (`MediaSource`, `MediaOverlay`).                           |
| `notification` | builder                 | Toasts are imperative: `useToast` (in `hooks.ts`) plays the builder role.                                                              |
| core `error`   | provider, builder, view | Boundaries are class components configured through props; `boundary.tsx` is the view, `listener.ts` and `reporter.ts` are topic files. |

## 5. Adding a module

1. **Create** `src/modules/<name>/` with `index.ts`, `types.ts`, `constants.ts`, `utils.ts`, and (as needed) `context.tsx`, `hooks.ts`, `overlay.tsx`, `motion.ts`, `module.tsx`.
2. **Define it** in `module.tsx`:
   ```ts
   export const announcementModule = defineModule({
     id: "announcement", // camelCase
     context: AnnouncementContext,
     Provider: AnnouncementProvider,
     Overlay: AnnouncementBanner,
     uses: ["dock"], // only peers you read via definePeer/useModuleState
     registry: {
       keyPolicy: "singleton",
       singletonKey: "current",
       lifecycle: "route",
     },
     page: {
       entries: (slice) => [{ key: "current", value: slice }],
       use: useAnnouncementPage,
     },
   });
   declare module "@omerdlw/base-framework/kernel" {
     interface CoreModules {
       announcement: typeof announcementModule;
     }
     interface PageConfig {
       announcement?: AnnouncementConfig;
     }
   }
   ```
3. **Theme it:** `defineThemeSpec<Slots>("announcement")` in `constants.ts`, `src/config/announcement.module.theme.ts` with `defineTheme`, and list it in `src/config/index.ts` (otherwise `useTheme` throws).
4. **Export it** from `src/modules/index.ts` (and add it to `defaultModules` if it ships by default).
5. **Document it** at `src/docs/modules/announcement.md` using the page structure in §6 and add a row to the index above.
6. **Test it** in `tests/modules/announcement.test.ts` ([testing.md](../testing.md#41-adding-tests-for-a-new-module)); register its registry type in `tests/support/registry.ts` if it has one.
7. **Run the pre-flight** (`type-check`, `lint`, `check:architecture`, `test`). The architecture test verifies the template, the doc page, overlay purity and one-context-per-module.

In downstream projects `src/modules` is yours: add, change or delete modules there without touching `src/core`.

## 6. Structure of a module page

Every page follows this skeleton (omit sections that do not apply). Keep it **verified against the code**: names, defaults, numbers and file maps must match the source.

1. **Title + "Read this first if you need to…"** one-liner.
2. **At a glance** table: import, id, what it renders, registry type, page key, peers, theme, events/DOM contracts, tests.
3. **Mental model** (diagram or short rules).
4. **Quick start** with the 80 % usage.
5. **Capabilities** (matrix with where to read more).
6. **API reference**: every public export with signature, defaults and behaviour; option tables.
7. **Behaviour details**: lifecycle, ordering, edge cases, accessibility.
8. **Theming**: slots and what stays in code.
9. **Recipes and gotchas**.
10. **File map** (every file, one responsibility each).
11. **Dependencies** (uses / peers / used by).

## 7. Dependency direction

```
src/app ─┐
src/features ─┼─▶ @omerdlw/base-framework/modules/* ──▶ @omerdlw/base-framework/kernel ──▶ @omerdlw/base-framework/{utils,hooks,tokens,events,result}
src/core/provider.tsx ┘         │
                               └──▶ @omerdlw/base-framework/atoms, @omerdlw/base-framework/theme
```

Modules are installed by `CoreProvider` from the list the app passes; orchestration drives modules through their `defineModule` definitions and never imports them.
