# 6.0.0 Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `@omerdlw/base-framework` onto a checked layered layout (`foundation → react → core → modules`). Split the oversized modules, modernize the code to React 19.3 + React Compiler, add ESLint/Prettier, and ship it as 6.0.0.

**Architecture:** This is a behaviour-preserving refactor, done in small commits with the existing 712 tests as the safety net. Folder paths encode layers, and `scripts/check-architecture.mjs` enforces them. One entries file drives tsup, `"use client"` banners and `package.json#exports`. The compiler runs only in the build; tests run uncompiled source plus a real dist smoke run.

**Tech Stack:** React 19.3, Next 16.3, TypeScript 5.8, tsup 8.5 (esbuild), `babel-plugin-react-compiler`, ESLint 9 flat config + typescript-eslint + eslint-plugin-react-hooks, Prettier 3, `node --test` with happy-dom.

**Spec:** `docs/superpowers/specs/2026-11-12-restructure-6.0-design.md`

## Global Constraints

- Branch `restructure-6.0`. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests may be moved and import paths updated, but none may be deleted. The final count is ≥ 712.
- Layer import rule: `foundation/*` → itself only; `react/*` → foundation, react; `core/*` → foundation, react, core; `modules/<a>/*` → lower layers + `modules/<a>`; only `src/index.ts` and `src/modules/index.ts` may import everything.
- A module never imports another module, even if it is declared in `uses`.
- `foundation/*` never imports `react`, `react-dom`, `next/*` or `motion/*`.
- No file under `src/` exceeds 400 lines at the end. Exceptions are listed in the spec with a reason.
- Moves happen in commits that contain only moves and import rewrites (`git mv`), so history follows the files.
- Node `>=22`; CI matrix `22.x`, `24.x`.
- Public subpaths are exactly the 6.0 column of spec §4. `./modules/*`, `./design` and `./design/recipes` are gone.
- Removed public names: `useModuleTheme` (use `useTheme`) and `useIsomorphicLayoutEffect` (use `useLayoutEffect`). The second goes only if Task 7 Step 1 confirms it is safe. Both are listed in `MIGRATION.md`.
- `npm run verify` = `format:check && lint && type-check && check:architecture && test && build && test:dist`.

## Review Focus

1. **`test:dist` currently tests `src/`, not `dist/`.** `tests/support/register.mjs` rewrites every `@omerdlw/base-framework*` specifier into `src/`. Once the compiler exists only in the build, a broken compiled bundle would pass. Fix in Task 3: dist runs set `BASE_FRAMEWORK_TARGET=dist`, and the loader then leaves package specifiers to Node's self-reference through `exports`.
2. **The loader's legacy `src/core/` → `src/` rewrite.** `register.mjs` maps `src/core/…` to `src/…`, and 14 test files import `../../src/core/…`. After Task 2 `src/core/` is real, so the rewrite must be deleted in the same commit. Otherwise tests silently resolve to the wrong files. Pinned in Task 2.
3. **Dock → navigation import is a hidden cross-module dependency.** `dock/routing/navigation.ts` imports `createNavigator`, `NAVIGATION_STATUS` and navigation types from `../../navigation/*`. The navigator engine moves to `core/navigation/` (Task 4), and the architecture check then forbids cross-module imports outright.
4. **Server-safe entries pulling client code.** After moves, `./recipes`, `./result`, `./events`, `./utils`, `./ambient/server` and `./ambient/worker` must still carry no `"use client"` and no React. Task 3 checks this against the built files, not only against sources.
5. **Memo removal changing identity semantics.** Context values, `useSyncExternalStore` subscribe/getSnapshot and effect deps can loop or over-render once their memo is gone and the code is uncompiled (tests and any consumer using source). Task 9 adds a render-count test for the registry and theme providers before removing memos.

---

### Task 1: Tooling baseline

**Files:**
- Create: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`
- Modify: `package.json` (devDependencies, scripts, `engines`, `files`), `tsconfig.json`, `.gitignore`, `.github/workflows/ci.yml`
- Modify: any `src/**`/`tests/**` file the new lint/type flags flag (fixes only, no behaviour change)

**Interfaces:**
- Produces: `npm run lint`, `lint:fix`, `format`, `format:check`, `verify` (definition in Global Constraints).

- [ ] **Step 1:** Install the dev dependencies `eslint@^9`, `typescript-eslint@^8`, `eslint-plugin-react-hooks@latest`, `prettier@^3` and `globals`.
- [ ] **Step 2:** Write `.prettierrc.json` as `{}` plus `"trailingComma": "all"`. Prettier's defaults already match the repo's 0b6db18 formatting. Write `.prettierignore` with `dist`, `node_modules`, `*.tgz`, `package-lock.json`.
- [ ] **Step 3:** Run `npx prettier --check .`. Expected: only non-source files differ (docs/markdown). If source files differ, adjust the config until they don't. The config must describe the existing style, not reformat the code.
- [ ] **Step 4:** Write `eslint.config.js` (flat config):
  - `tseslint.configs.recommendedTypeChecked` and `stylisticTypeChecked`, with `parserOptions.projectService: true`;
  - `reactHooks.configs.recommended` (`'recommended-latest'` if that is what the installed version names its flat preset);
  - `@typescript-eslint/consistent-type-imports: error`;
  - `no-restricted-imports`, which bans `@omerdlw/base-framework/dist/*` everywhere and `react`, `react-dom`, `react/*`, `next`, `next/*`, `motion`, `motion/*` in files matching `src/foundation/**`. That glob matches nothing until Task 2 and is harmless before then.
  - Ignore `dist/**` and `scripts/**/*.mjs` for type-checked rules.
- [ ] **Step 5:** Add `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, `noFallthroughCasesInSwitch` to `tsconfig.json`. Run `npm run type-check` and fix every error. `verbatimModuleSyntax` errors are fixed by adding `type` to imports. Unused parameters are prefixed `_` only when they are part of a public callback signature; otherwise they are removed.
- [ ] **Step 6:** Run `npm run lint`.
  - Fix all errors.
  - React Compiler rule reports (`react-hooks/*` compiler diagnostics) may be downgraded to `warn` in this task only. Record the count in the commit message; Task 9 brings it to 0 and restores `error`.
  - Each remaining `any` or `as unknown as` gets a one-line reason comment or a proper type.
- [ ] **Step 7:** Update `package.json`:
  - scripts: `lint` = `eslint .`, `lint:fix`, `format` = `prettier --write .`, `format:check` = `prettier --check .`, `verify`;
  - `"engines": { "node": ">=22" }`;
  - `"files"` gains `"!docs/superpowers"`.
- [ ] **Step 8:** Add `.remember/` to `.gitignore`. Delete the local `omerdlw-base-framework-1.0.5.tgz` and `.DS_Store`; both are untracked, so no git change. Rewrite `ci.yml` to use matrix `[22.x, 24.x]` and a single `npm run verify` step after `npm ci`.
- [ ] **Step 9:** Run `npm run verify`. Expected: exit 0, `ℹ pass 712`.
- [ ] **Step 10:** Commit `Tooling: ESLint, Prettier, stricter tsconfig and a verify script`.

---

### Task 2: Move to the layered layout

**Files:** `git mv` only, plus import rewrites, `tsconfig.json#paths`, `tsup.config.ts` entry sources, `tests/support/register.mjs`.

| From | To |
|---|---|
| `src/result.ts` | `src/foundation/result/index.ts` |
| `src/events.ts` | `src/foundation/events/index.ts` |
| `src/utils/*` | `src/foundation/utils/*` |
| `src/design/{recipe,recipes,define,anatomy,split,cn,types}.ts` | `src/foundation/recipes/{recipe,index,define,anatomy,split,cn,types}.ts` (`recipes.ts` → `index.ts`) |
| `src/kernel/context-registry.ts` | `src/react/context/index.ts` |
| `src/hooks/*` | `src/react/hooks/*` |
| `src/theme.tsx` | `src/react/theme/index.tsx` |
| `src/design/{components/*,provider.tsx,utils.ts,index.ts}` | `src/react/ui/{components/*,provider.tsx,utils.ts,index.ts}` |
| `src/kernel/*` (rest) | `src/core/kernel/*` |
| `src/error/*` | `src/core/error/*` |
| `src/provider.tsx` | `src/core/provider/index.tsx` |
| `tests/core/{result,events,utils}.test.ts`, `tests/design/recipe.test.ts` | `tests/foundation/…` |
| `tests/core/{hooks,theme,motion}.test.ts`, `tests/design/components.test.ts` | `tests/react/…` |
| `tests/core/{kernel,error}.test.ts` | `tests/core/…` (stay) |

**Interfaces:**
- Produces: alias `@/` still maps to `src/`. Imports are layer-qualified: `@/foundation/utils`, `@/react/theme`, `@/core/kernel`, … Everything later in this plan uses these paths.
- Produces: `getOrCreateGlobalContext` exported from `@/react/context` and re-exported from `@/core/kernel/index.ts`, so the public `./kernel` keeps it.

- [ ] **Step 1:** Write `scripts/codemods/relayer-imports.mjs`.
  - Input: the From→To table above, as a map of old→new module paths.
  - It rewrites every `@/…` and relative specifier in `src/**` and `tests/**` whose resolved target moved, emitting `@/…` paths for cross-folder imports and relative paths inside the same folder.
  - Specifiers stay extensionless in `src`; tests keep their `.ts`/`.tsx` extensions.
  - The codemod is deleted after use and not committed.
- [ ] **Step 2:** Do the `git mv`s, then run the codemod.
- [ ] **Step 3:** Fix `tests/support/register.mjs`: delete the `@/core/` branch and the `src/core/` → `src/` replace (Review Focus 2). Test files that imported `../../src/core/<x>` must now point at the real new locations; the codemod handles them, since it resolves through the old rewrite semantics.
- [ ] **Step 4:** Update the `tsconfig.json#paths` entries for `@omerdlw/base-framework/*` so each public subpath points at its new source. Spell out each subpath explicitly; there is no `./src/*` wildcard any more. Update the tsup entry sources to the new files, keeping the dist output keys unchanged for now. Task 3 changes those.
- [ ] **Step 5:** Run `npm run verify`. Expected: exit 0, 712 pass. Then run `grep -rn "src/core" tests/support/register.mjs`. Expected: no output.
- [ ] **Step 6:** Commit `Move sources into foundation/react/core/modules layers` (moves and import rewrites only).

---

### Task 3: One entries source, 6.0 subpaths, real dist smoke

**Files:**
- Create: `scripts/entries.mjs`, `scripts/sync-exports.mjs`
- Modify: `tsup.config.ts`, `package.json` (`exports`, scripts), `tests/support/register.mjs`, `tests/bundle/dist.smoke.ts`, `tests/architecture.test.ts`
- Create: `src/react/ui/index.ts` re-exporting `@/foundation/recipes` (spec §4)

**Interfaces:**
- Produces: `export const ENTRIES: ReadonlyArray<{ subpath: string; source: string; out: string; client: boolean }>` in `scripts/entries.mjs`. `subpath` is the `package.json` key (`"."`, `"./ui"`…). `out` is the dist path without extension (`"index"`, `"ui/index"`, `"recipes/index"`, `"dock/index"`, `"ambient/server/index"`…).
- Produces: `node scripts/sync-exports.mjs [--check]`. Without the flag it writes `package.json#exports`; with `--check` it exits 1 if the file differs.

- [ ] **Step 1:** Write the failing tests in `tests/architecture.test.ts`:
  - `"package exports match scripts/entries.mjs"` runs `node scripts/sync-exports.mjs --check` and expects exit 0.
  - `"every non-client entry source is in foundation/ or an ambient server/worker entry"` asserts each `client: false` entry's `source` starts with `src/foundation/` or `src/modules/ambient/{server,worker}/`.
  - `"exports has exactly the 6.0 subpaths"` deep-equals the sorted keys of `package.json#exports` with: `.`, `./result`, `./events`, `./utils`, `./recipes`, `./hooks`, `./theme`, `./ui`, `./kernel`, `./error`, `./provider`, `./modules`, `./ambient`, `./ambient/server`, `./ambient/worker`, `./background`, `./context-menu`, `./controls`, `./dock`, `./loading`, `./media`, `./modal`, `./navigation`, `./notification`.
- [ ] **Step 2:** Run `npm test -- --test-name-pattern="exports"`. Expected: FAIL, because `scripts/entries.mjs` is missing.
- [ ] **Step 3:** Write `entries.mjs` covering the 24 subpaths above.
  - `sync-exports.mjs` emits `{ types: "./dist/<out>.d.ts", import: "./dist/<out>.js", default: "./dist/<out>.js" }` per entry.
  - `tsup.config.ts` builds its two configs by filtering `ENTRIES` on `client`.
  - The `onSuccess` `"use client"` pass iterates `ENTRIES.filter(e => e.client)`, replacing the hand list.
  - `tsc --emitDeclarationOnly` output layout must match `out`. If it doesn't (declarations follow source paths), `rewrite-dts-aliases.mjs` gains a step that writes `dist/<out>.d.ts` shims `export * from "<relative path to the emitted declaration>"`.
  - Run `node scripts/sync-exports.mjs` once and commit the result. Add `npm run sync-exports` to the scripts.
  - `check-architecture.mjs` imports `ENTRIES` and runs the same comparison, so a drift fails `check:architecture` as well as the test (spec §4).
- [ ] **Step 4:** Make the loader honour `BASE_FRAMEWORK_TARGET=dist`: skip the `@omerdlw/base-framework` rewrites so Node resolves the package by self-reference. Set `test:dist` to `BASE_FRAMEWORK_TARGET=dist node --import ./tests/support/register.mjs --test 'tests/bundle/*.smoke.ts'`.
- [ ] **Step 5:** Update `dist.smoke.ts`:
  - `SERVER_SAFE_ENTRIES` becomes `["result/index.js", "events/index.js", "recipes/index.js", "utils/index.js", "ambient/server/index.js", "ambient/worker/index.js"]` (from `ENTRIES`).
  - Add the test `"a package import resolves into dist"`: `import.meta.resolve("@omerdlw/base-framework/kernel")` contains `/dist/`.
  - Add the test `"server-safe entries and their chunks carry no use client and no react import"`, which walks static imports from each built file.
- [ ] **Step 6:** Run `npm run verify`. Expected: exit 0. The new tests pass, and `test:dist` reports the resolve test passing.
- [ ] **Step 7:** Commit `Entries: one source for tsup, exports and client banners; 6.0 subpaths`.

---

### Task 4: Enforce layers and module isolation

**Files:**
- Modify: `scripts/check-architecture.mjs`, `tests/architecture.test.ts`
- Move: `src/modules/navigation/{navigator,settings}.ts` and the types and constants `navigator.ts` needs → `src/core/navigation/{navigator,settings,types,constants}.ts`. `src/modules/navigation/*` re-exports what its public index exported before.
- Modify: `src/modules/dock/routing/navigation.ts` to import from `@/core/navigation/*`.

**Interfaces:**
- Consumes: the layer paths from Task 2.
- Produces: `check-architecture.mjs` prints `Architecture check passed (<n> files, no cycles, layers respected, modules isolated, peers declared).`

- [ ] **Step 1:** Write the failing tests. `tests/architecture.test.ts` gains a fixture-driven suite: write temp `src/` trees with `tests/support/fixture.ts`, then run the script there with `cwd` set to the temp dir. The cases:
  - `"rejects an upward import"`: `src/react/x.ts` imports `@/core/kernel`. The run exits 1 and stderr contains `Layer violation: src/react/x.ts (react) imports src/core/kernel/index.ts (core)`.
  - `"rejects a cross-module import even when declared in uses"`: `src/modules/a/module.tsx` has `uses: ["b"]` and imports `../b/x`. The run exits 1 and stderr contains `Module isolation: src/modules/a/module.tsx imports module "b"`.
  - `"allows the barrels to import anything"`: `src/index.ts` and `src/modules/index.ts` import across layers. The run exits 0.
  - `"rejects react in foundation"`: `src/foundation/x.ts` imports `react`. The run exits 1 with `Foundation purity: src/foundation/x.ts imports react`.
  - Replace the two old ad-hoc tests (`src/design must not import from @/modules`, `src/kernel must not import from @/modules`) with these. The total test count must not drop, so keep or replace them one-for-one.
- [ ] **Step 2:** Run the architecture tests. Expected: the new cases FAIL.
- [ ] **Step 3:** Implement the three rules in `check-architecture.mjs`:
  - layer rank from the path: `foundation=0`, `react=1`, `core=2`, `modules=3`;
  - module name from `src/modules/<name>/`;
  - barrels exempt;
  - foundation bare-specifier check against `react`, `react-dom`, `next`, `motion` and their subpaths.
  - Remove the "import of another module counts as a read" logic; that case is now a hard error.
- [ ] **Step 4:** Run `npm run check:architecture` on the real tree. Expected: it fails only on `dock/routing/navigation.ts` → navigation. Do the `core/navigation` move from Files. Dock then imports from core, and the navigation module re-exports.
- [ ] **Step 5:** Run `npm run verify`. Expected: exit 0.
- [ ] **Step 6:** Commit `Architecture: enforce layers and module isolation; navigator engine moves to core`.

---

### Task 5: Split the dock module

**Files (target layout, spec §3.2):**
- `src/modules/dock/components/` — one file per entry, each listing what it exports from today's `overlay.tsx`:
  - `card-banner.tsx`: DockCardBanner
  - `command-bar.tsx`: DockCommandBar, DockCommand
  - `description.tsx`: DockDescription
  - `title.tsx`: DockTitle
  - `badge.tsx`: Badge
  - `icon.tsx`: DockIcon, DockIconOverlay, `renderIconNode`
  - `card-header.tsx`: DockCardHeader
  - `card-item.tsx`: DockCardItem
  - `item-content.tsx`: StandardItemContent, LoadingItemContent
  - `media-controls.tsx`: DockMediaControls
  - `media-scrubber.tsx`: DockMediaScrubber
  - `hud-view.tsx`: DockHudView
  - `breadcrumbs-card.tsx`: DockBreadcrumbsCard
  - `status-actions.tsx`: ErrorActions, GuardActions, NotFoundActions
  - `dock.tsx`: Dock
  - `surface/action.tsx`: DockSurfaceAction, DockSurfaceExtension, `renderActionSlot`
  - `surface/extensions-bar.tsx`: DockSurfaceExtensionsBar, ExtensionPill
  - `surface/header-button.tsx`: DockSurfaceHeaderButton, `getControlRadiusClass`, `applyControlRadius`
  - `surface/controls.tsx`: DockSurfaceControls
  - `surface/shell.tsx`: DockSurfaceShell
  - `surface/item-content.tsx`: SurfaceItemContent, SurfaceStackItemContent, DockSurfaceLoader
- `src/modules/dock/hooks/`, from `cards.tsx`, `hooks.ts`, `hud.ts`:
  - `use-card-banner-model.ts`, `use-command-bar-model.ts`, `use-badge.ts`, `use-card-header-model.ts`, `use-action-slot.ts`, `use-standard-item-content-model.ts`, `use-card-item-model.ts`, `use-media-controls-model.ts`, `use-media-scrubber-model.ts`, `use-hud-view-model.ts`;
  - today's `hooks.ts` → `use-dock-theme.ts` (`useDockTheme`, `useDockActionClass`).
  - The non-hook exports of `cards.tsx` (`isSurfaceLayerShown`, `stopAndPrevent`, `stopPropagationOnly`, `shouldShowMediaIcon`, `applyMediaAction`, `DockActionSlot`) go to `lib/card.ts`. The non-hook parts of `hud.ts` go to `model/hud.ts`.
- `src/modules/dock/model/`: `state.ts`, `layout.ts`, `paths.ts`, `hud.ts`.
- `src/modules/dock/lib/`: `dom.ts`, `styles.ts`, `helpers.ts`, `card.ts`.
- `src/modules/dock/types/`: `card.ts`, `surface.ts`, `hud.ts`, `media.ts`, `routing.ts`, `theme.ts`, `index.ts` (`export type *` from each). Split today's `types.ts` by the prefix and use of each declaration.
- The existing `routing/`, `runtime/`, `status/` and `surface/` subfolders stay. Any of their files over 400 lines is split into `<name>/model/*` and `<name>/hooks/*` along the same lines; this applies to `surface/machine.ts`, `surface/hooks.tsx`, `surface/definition.ts`, `surface/stack.ts`, `runtime/display.ts`, `runtime/dock.tsx` and `routing/navigation.ts`.
- Tests: `tests/modules/dock.test.ts` and `dock-motion.test.ts` get import paths updated only.

**Interfaces:**
- Produces: `src/modules/dock/index.ts` exports exactly the same names as before. This is pinned by a test.
- Rule: inside a module, value imports go to the concrete file. Only `types/index.ts` may be imported as a barrel, because it is type-only.

- [ ] **Step 1:** Write the failing test `"dock public surface is unchanged"` in `tests/modules/dock.test.ts`. It does `Object.keys(await import("../../src/modules/dock/index.ts")).sort()` and deep-equals the list captured *now*. Capture the list by running the same expression once and pasting the literal array into the test.
- [ ] **Step 2:** Run it. Expected: PASS. This test is a guard, not red-first; it protects the split.
- [ ] **Step 3:** Do the split with `git mv overlay.tsx components/dock.tsx`, `cards.tsx` → `hooks/use-card-item-model.ts` and `types.ts` → `types/card.ts`, so history follows the largest piece. Then cut the other declarations into their files. Bodies are moved, not edited, in this task.
- [ ] **Step 4:** Run `npm run verify`, then `find src/modules/dock -name '*.ts*' | xargs wc -l | awk '$1>400'`. Expected: verify exits 0 and the `find` prints only `total`.
- [ ] **Step 5:** Commit `Dock: one component per file, hooks, model, lib and types folders`.

---

### Task 6: Split background and modal

**Files:**
- `src/modules/background/`:
  - `overlay.tsx` (668) → `components/overlay.tsx` plus one file per inner component it defines;
  - `youtube/player.tsx` (596) → `youtube/components/player.tsx` + `youtube/hooks/use-youtube-player.ts`;
  - `youtube/iframe.ts` → `youtube/lib/iframe.ts`;
  - `youtube/parse.ts` → `youtube/lib/parse.ts`;
  - `state.ts`, `playback.ts`, `visual.ts` → `model/`.
- `src/modules/modal/`:
  - `overlay.tsx` (420) → `components/overlay.tsx` plus its inner components;
  - `state.ts`, `layout.ts`, `identity.ts`, `header.ts` → `model/`;
  - `dom.ts` → `lib/dom.ts`.
- Tests: import paths only, plus one public-surface guard test per module, as in Task 5 Step 1.

- [ ] **Step 1:** Add the guard tests `"background public surface is unchanged"` and `"modal public surface is unchanged"`. Run them: PASS.
- [ ] **Step 2:** Split each module (move-first, as in Task 5 Step 3). Run `npm run verify` and the 400-line `find` for both folders. Expected: exit 0, no files listed.
- [ ] **Step 3:** Commit `Background, Modal: folder layout`.

---

### Task 7: React 19 patterns and public-name cleanup

**Files:** `src/react/theme/index.tsx`, `src/react/ui/provider.tsx`, `src/react/hooks/*`, and every file using `useContext`, `useIsomorphicLayoutEffect` or latest-ref patterns (21 / 43 / found by grep). Also `src/react/hooks/index.ts`, the six `useModuleTheme` call sites and `MIGRATION.md` (create).

- [ ] **Step 1:** Verify the `useLayoutEffect` server behaviour. Write a test `"useLayoutEffect renders on the server without a warning"` in `tests/react/hooks.test.ts`: `renderToString(h(C))`, where `C` calls `useLayoutEffect`, with a `console.error` mock, asserting zero calls. Run it.
  - PASS → do Step 3a.
  - FAIL → skip 3a, keep `useIsomorphicLayoutEffect`, and drop it from MIGRATION.
- [ ] **Step 2:** Run `grep -rnE "\.current\s*=\s*(on|handle|callback|fn)[A-Za-z]*\b" src` to list latest-ref sites. Each site whose ref is read only inside an effect or subscription callback becomes `useEffectEvent`. A ref read during render stays as it is.
- [ ] **Step 3a:** Replace `useIsomorphicLayoutEffect` with `useLayoutEffect` everywhere. Delete `src/react/hooks/use-isomorphic-layout-effect.ts` and its export.
- [ ] **Step 3b:** `useContext(X)` → `use(X)`. `createElement(X.Provider, { value }, c)` → `<X value={value}>{c}</X>` (the file becomes `.tsx` if needed). `useRequiredContext` uses `use` internally.
- [ ] **Step 3c:** Remove the `useTheme as useModuleTheme` alias and update its six call sites to `useTheme`.
- [ ] **Step 4:** Create `MIGRATION.md` with three sections: the subpath table (spec §4, 5.x → 6.0 columns), removed names with their replacements, and the Node `>=22` requirement.
- [ ] **Step 5:** Run `npm run verify`. Expected: exit 0. Then run `grep -rnE "useContext\(|\.Provider\b|useIsomorphicLayoutEffect|useModuleTheme" src`. Expected: only `TooltipPrimitive.Provider` (Radix) and `scope.Provider` in `page-controller.tsx` if that is a scope object rather than a React context; each remaining line is checked by hand.
- [ ] **Step 6:** One commit per area, all with the prefix `React 19:` — `react/` layer, `core/` layer, then each module.

---

### Task 8: Readability pass and public JSDoc

**Files:** all of `src/**`, module by module, in the same order as Task 7.

- [ ] **Step 1:** For each module or folder, apply spec §5.3:
  - components as `function` declarations with `interface XProps`;
  - no nested ternaries; JSX conditions named;
  - functions over ~40 lines split;
  - magic numbers named in `constants.ts`;
  - imports ordered external → `@/` → relative, with `import type`.
- [ ] **Step 2:** Add a one- to three-line JSDoc to every name exported from a public entry (the `source` files in `scripts/entries.mjs` and what they re-export). It says what the name is for, not how it works. Internal comments are added only for a non-obvious "why".
- [ ] **Step 3:** After each module, run `npm run verify` and commit as `Readability: <area>`.

---

### Task 9: React Compiler

**Files:**
- Create: `scripts/esbuild-react-compiler.mjs`
- Modify: `tsup.config.ts`, `package.json` (devDeps `babel-plugin-react-compiler`, `@babel/core`, `@babel/preset-typescript`), `eslint.config.js` (compiler rules back to `error`), `tests/core/kernel.test.ts`, `tests/react/theme.test.ts`, and every `src/` file with `useMemo`, `useCallback` or `memo(`.

**Interfaces:**
- Produces: `export function reactCompiler(options: { include: RegExp; report: (event: { filename: string; kind: string; reason?: string }) => void }): import("esbuild").Plugin`.
  - `include` = `/src\/(react|core|modules)\/.*\.tsx?$/`.
  - The plugin's `onLoad` reads the file, runs `@babel/core.transformAsync` with `presets: [["@babel/preset-typescript", { isTSX: file.endsWith(".tsx"), allExtensions: true }]]`, `plugins: [["babel-plugin-react-compiler", { target: "19", logger: { logEvent: (filename, event) => report(...) } }]]`, `sourceMaps: "inline"`, and returns `{ contents, loader: "tsx" | "ts" }`. Babel strips the TS syntax while keeping JSX; esbuild then handles the JSX.

- [ ] **Step 1:** Write the failing tests:
  - `"registry provider does not re-render consumers when the parent re-renders"` (`tests/core/kernel.test.ts`). A stateful `Parent` renders `<RegistryProvider>{children}</RegistryProvider>`, where `children` is a `<Consumer />` element created outside `Parent`. Its identity is stable, so only a context value change can re-render it. `Consumer` calls `useRegistryActions()` and increments a counter on each render. Bump `Parent`'s state 3 times inside `act`, then `assert.equal(renders, 1)`.
  - `"theme provider keeps its context value stable across parent renders"` (`tests/react/theme.test.ts`). Same shape.
  - `"built kernel entry is compiled"` (`tests/bundle/dist.smoke.ts`). Read `dist/kernel/index.js` and all its chunks; at least one contains `react/compiler-runtime`.
- [ ] **Step 2:** Run the tests. Expected: the two provider tests PASS today, since memos are still in place; they are guards for Step 5. The dist test FAILs, since no compiler is wired yet.
- [ ] **Step 3:** Implement the plugin and add it to both tsup configs' `esbuildPlugins`. `report` collects events, and `onSuccess` prints `React Compiler: <compiled> compiled, <skipped> skipped` followed by one line per skip (`filename: reason`).
- [ ] **Step 4:** Run `npm run build && npm run test:dist`. Expected: the dist test passes, and the skip list is printed.
- [ ] **Step 5:** Remove `useMemo`, `useCallback` and `memo()` file by file. The spec §5.1 exceptions stay:
  - lazy `useState`/`useRef` singletons stay;
  - `useSyncExternalStore` `subscribe`/`getSnapshot` built from stable store methods are hoisted out of the component instead of memoized;
  - a context value built from stable parts may stay a `useMemo` **only if** the Step 1 guard fails without it in uncompiled tests. In that case keep it, with a comment `// stable identity: consumers subscribe by reference`.
- [ ] **Step 6:** Fix every skip reported in Step 4, or add it, with its reason, to the "Compiler exceptions" list in `docs/architecture-and-rules.md`. Set the compiler lint rules back to `error`; `npm run lint` must report 0 of them.
- [ ] **Step 7:** Measure bundle size:
  - Build a baseline with `git worktree add <scratchpad>/baseline 0c69e9a && cd <scratchpad>/baseline && npm ci && npm run build`. For both builds, measure `du -sk dist` and each entry's gzip size (`gzip -c <file> | wc -c`). Remove the worktree afterwards.
  - Put the before/after table in the commit message.
  - Total gzip growth over 10% → stop and report to the user before committing (spec §9).
- [ ] **Step 8:** Run `npm run verify`. Expected: exit 0. Then run `grep -rcE "useMemo\(|useCallback\(|\bmemo\(" src | awk -F: '{s+=$2} END {print s}'`. The count is reported and each remaining site carries its reason comment.
- [ ] **Step 9:** Commit `React Compiler: compile the client layers, drop hand-written memoization`.

---

### Task 10: Docs, migration and release

**Files:** `docs/**/*.md` (except `docs/superpowers`), `templates/AGENTS.md`, `README.md`, `MIGRATION.md`, `package.json` (`version`).

- [ ] **Step 1:** Rewrite `docs/architecture-and-rules.md` §1–§5 for spec §3:
  - the layer table, both module layouts, the "where does code go" tree with the new paths;
  - Rule 10's command becomes `npm run verify`;
  - the §4 enforcement table names ESLint, Prettier, the architecture script's four rules and the real test count;
  - the compiler exceptions list from Task 9.
- [ ] **Step 2:** Run `grep -rnE "base-framework/(design|modules/)" docs templates README.md`. Rewrite every hit to the 6.0 subpaths; re-run until there is no output.
- [ ] **Step 3:** Set `"version": "6.0.0"` and run `npm run sync-exports`. In `README.md`, add the Node `>=22` requirement and a link to `MIGRATION.md`.
- [ ] **Step 4:** Run `npm run verify`, then `npm pack --dry-run 2>&1 | grep -E "superpowers|\.tgz|src/"`. Expected: verify exits 0 and the grep prints nothing.
- [ ] **Step 5:** Commit `Release 6.0.0: layered structure, React Compiler, tooling`.
