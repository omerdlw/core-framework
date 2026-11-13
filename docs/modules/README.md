# Module Reference

> **Read this first if you need to:** find which module does what, see how modules connect, add a new module, or learn the structure every module page follows.

One page per module/core entry. Each page answers, from the big picture down to the details: **what it is → mental model → quick start → capabilities → full API → behaviour → theming → recipes/gotchas → file map → dependencies**.

## 1. Index

| Module         | Import                                                    | Doc                                      | What it owns                                                                                       | Page key (`usePage`) | Registry type |
| :------------- | :-------------------------------------------------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------- | :------------------- | :------------ |
| Kernel         | `@omerdlw/base-framework/kernel`                          | [kernel.md](./kernel.md)                 | Module host, registry, `usePage`, `defineModule`, peers                                            | `title`, `registry`  | —             |
| Dock           | `@omerdlw/base-framework/dock`                            | [dock.md](./dock.md)                     | The only chrome: card stack, surfaces/flows, HUD, operations, status overlays, guards, breadcrumbs | `dock`               | `dock`        |
| Modal          | `@omerdlw/base-framework/modal`                           | [modal.md](./modal.md)                   | Promise-based stacked dialogs                                                                      | `modal`              | `modal`       |
| Notification   | `@omerdlw/base-framework/notification`                    | [notification.md](./notification.md)     | Single-slot toasts docked to the dock; event-driven feedback                                       | `notification`       | —             |
| Navigation     | `@omerdlw/base-framework/navigation`                      | [navigation.md](./navigation.md)         | Trips: exit holds, payload to the next page, back-button hold, intent prefetch                     | —                    | —             |
| Loading        | `@omerdlw/base-framework/loading`                         | [loading.md](./loading.md)               | Loading overlay + busy flag                                                                        | `loading`            | `loading`     |
| Background     | `@omerdlw/base-framework/background`                      | [background.md](./background.md)         | Image / video / YouTube layer behind the page                                                      | `background`         | `background`  |
| Media          | `@omerdlw/base-framework/media`                           | [media.md](./media.md)                   | The active media session the dock controls operate on                                              | `media`              | `media`       |
| Ambient        | `@omerdlw/base-framework/ambient`                         | [ambient.md](./ambient.md)               | Image → palette → CSS color variables                                                              | `ambient`            | —             |
| Controls       | `@omerdlw/base-framework/controls`                        | [controls.md](./controls.md)             | Paired control rails beside the dock                                                               | `controls`           | `controls`    |
| Context menu   | `@omerdlw/base-framework/context-menu` (id `contextMenu`) | [context-menu.md](./context-menu.md)     | Declarative right-click menus                                                                      | `contextMenu`        | `contextMenu` |
| Error boundary | `@omerdlw/base-framework/error`                           | [error-boundary.md](./error-boundary.md) | Boundaries, reporter, window error listener                                                        | —                    | —             |
| Result         | `@omerdlw/base-framework/result`                          | [result.md](./result.md)                 | `Result<T, E>`, `createSafeAction`                                                                 | —                    | —             |

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

| Reader → source               | How                      | Used for                                                                                                   |
| :---------------------------- | :----------------------- | :--------------------------------------------------------------------------------------------------------- |
| dock → `loading`              | `definePeer`             | Page-loading flag; `stopLoading()` after navigation.                                                       |
| dock → `media`                | `definePeer`             | Play/pause icon, media controls.                                                                           |
| dock → `notification`         | `definePeer`             | Is a toast visible (breadcrumbs yield).                                                                    |
| dock → `navigation`           | `useModule`              | Transactions are its trips; card prefetch uses its warm cache. Without it the dock runs its own navigator. |
| background → `media`          | `definePeer`             | Registers the background video as source `background`.                                                     |
| ambient → `background`        | `useModuleState`         | Poster URL as the default tint image.                                                                      |
| context-menu → `dock`         | `useModuleState`         | Active card as the default menu header.                                                                    |
| notification, controls → dock | DOM id `dock-card-stack` | Portal target / rail anchor.                                                                               |
| dock ← events                 | `globalEvents`           | `APP_ERROR`, `API_ERROR`, `DOCK_STATUS_SET`, `DOCK_GUARD`, `DOCK_NOT_FOUND`.                               |
| notification ← events         | `globalEvents`           | `API_UNAUTHORIZED`, `APP_ERROR`/`STATE_CHANGE` with `notify: true`.                                        |

Every `definePeer`/`useModuleState`/`useModule` call needs the **peer id as a string literal** and the id in the module's `uses` (`npm run check:architecture` verifies it). Each peer ships an inert stand-in, so any module can be left out of `CoreProvider modules` and the rest still works.

## 3. Install-time facts

- `src/modules/index.ts` exports every module and `defaultModules` (`background, ambient, navigation, dock, controls, contextMenu, loading, media, modal, notification`); it is the only place that lists them all. `src/app/providers.tsx` passes the list to `CoreProvider`.
- Install a subset to ship less: `modules={[dockModule, notificationModule, loadingModule]}`.
- Module ids are **camelCase** (`contextMenu`); the folder and theme id may be kebab-case (`context-menu`).
- A module is installable when it has a `module.tsx` (or `module.ts`) with `defineModule`; the order of the list does not matter (`uses` sorts it).

## 4. Canonical module template

Modules use one of two layouts. Both are described in full in [architecture-and-rules §2](../architecture-and-rules.md#2-canonical-module-file-pattern). A slot that does not apply is omitted, never created empty. `npm run check:architecture` enforces the layers, module isolation and the 400-line file limit.

**Flat layout** (default): `index.ts`, `module.tsx`, `types.ts` and `constants.ts` are required; `context.tsx` (one context), `state.ts`, `hooks.ts`, `overlay.tsx`, `motion.ts` and `utils.ts` are optional, plus topic files for a cohesive concern.

**Folder layout** (`background`, `dock`, `modal`): `components/` (one public component per file), `hooks/` (one view-model file per component), `model/` (pure state, no React), `lib/` (pure helpers, no React) and `types/` (split by area, with an `index.ts`), next to `index.ts`, `module.tsx`, `constants.ts`, `context.tsx` and `motion.ts`.

Rules of thumb:

- A module imports another module only through its public barrel (`@/modules/<name>`) and only when `<name>` is in its `uses`. Looser needs go through peers or `globalEvents`.
- Barrels use explicit named exports (`export { a, b } from "./x"`), never `export *` from implementation files; `export type * from "./types"` is fine.
- **No design in code:** colors, sizes, radii and typography are theme slots (`src/config/<name>.module.theme.ts`); animation comes from the theme's `motion`.

### 4.1 File matrix (current)

| Module       | Layout |  `context`   | `hooks`  | `state`  |   `overlay`   | `motion` | Extras                                                                            |
| :----------- | :----: | :----------: | :------: | :------: | :-----------: | :------: | :-------------------------------------------------------------------------------- |
| ambient      |  flat  |      ✅      |    ✅    |    —     |       —       |    —     | `analyze*.ts`, `extractor.ts`, `pipeline.ts`, `settings.ts`, `server/`, `worker/` |
| background   | folder |      ✅      | `hooks/` | `model/` | `components/` |    ✅    | `youtube/`, `lib/`                                                                |
| context-menu |  flat  |      ✅      |    ✅    |    ✅    |      ✅       |    ✅    | `resolver.ts`, `items.ts`, `dom.ts`                                               |
| controls     |  flat  |      —       |    ✅    |    —     |      ✅       |    —     | `entries.ts`, `layout.ts`                                                         |
| dock         | folder | `context.ts` | `hooks/` | `model/` | `components/` |    ✅    | `provider.tsx`, `hud.ts`, `routing/`, `runtime/`, `status/`, `surface/`, `lib/`   |
| loading      |  flat  |      ✅      |    ✅    |    ✅    |      ✅       |    —     |                                                                                   |
| media        |  flat  |      ✅      |    ✅    |    —     |      ✅       |    —     | `playback.ts`, `session.ts`                                                       |
| modal        | folder |      ✅      | `hooks/` | `model/` | `components/` |    ✅    | `lib/`                                                                            |
| navigation   |  flat  |      ✅      |    ✅    |    —     |       —       |    —     | `listeners.ts`; the navigator machine lives in `src/core/navigation/`             |
| notification |  flat  |      ✅      |    ✅    |    ✅    |      ✅       |    ✅    |                                                                                   |

### 4.2 Why some optional slots are absent

| Module         | Absent                  | Reason                                                                                                                                 |
| :------------- | :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `ambient`      | `overlay`, `motion`     | Renders nothing: it writes CSS custom properties; transitions are CSS classes from the theme.                                          |
| `controls`     | `context`, `motion`     | Stateless: entries live in the registry and layout is measured from the DOM. No animation.                                             |
| `loading`      | `motion`                | The overlay renders `Spinner` (or a skeleton) and mounts/unmounts instantly.                                                           |
| `navigation`   | `overlay`, `motion`     | Renders nothing: it binds the router and listens to the document; animation is the app's, in its holds.                                |
| `media`        | `motion`                | Renders nothing; `overlay.tsx` holds only the components that return `null` (`MediaSource`, `MediaOverlay`).                           |
| `notification` | builder                 | Toasts are imperative: `useToast` (in `hooks.ts`) plays the builder role.                                                              |
| core `error`   | provider, builder, view | Boundaries are class components configured through props; `boundary.tsx` is the view, `listener.ts` and `reporter.ts` are topic files. |

## 5. Adding a module

1. **Create** `src/modules/<name>/` with `index.ts`, `types.ts`, `constants.ts`, and (as needed) `utils.ts`, `context.tsx`, `hooks.ts`, `overlay.tsx`, `motion.ts`, `module.tsx`.
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
src/features ─┼─▶ @omerdlw/base-framework/<module> ──▶ @omerdlw/base-framework/kernel ──▶ @omerdlw/base-framework/{utils,hooks,events,result}
src/core/provider.tsx ┘         │
                               └──▶ @omerdlw/base-framework/ui, @omerdlw/base-framework/theme
```

Modules are installed by `CoreProvider` from the list the app passes; orchestration drives modules through their `defineModule` definitions and never imports them.
