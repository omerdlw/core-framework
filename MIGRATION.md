# Migrating from 3.x to 3.2

3.2 reorganises the package into layers and tidies the public surface. Most of the change is where you import from and a few removed names. Runtime behaviour is the same apart from one bug fix (see [Fixed](#fixed)) and the components that are no longer `memo()`.

## The framework holds no design

Coming from 3.1.0, note that 3.2 also includes an unreleased step in which every visual decision moved to the app:

- `./styles.css`, the `styles/` folder, design tokens (`Z_INDEX`, motion presets), default recipes, tones, default motion, icon names and `templates/motion` are removed. Supply them from your app's `ui`.
- Atoms and `utils/cn` are removed. Use the vocabulary-free `cn` and the `./ui` components (`Button`, `Icon`, `Loader`, `Tooltip`). `Button` takes `href` to render a link.
- Components ship an anatomy of empty parts plus the states they set (`checked`, `active`, `visible`, `loading`). Without a `ui`, they render no classes.
- Component motion comes from `motion/react` variants in your `ui`. A missing key means no animation, and reduced motion uses your `still` variant.
- Modules take stacking from theme styles (the modal reads `styles.layer`). The dock loader is now a `surfaceLoader` slot.
- `defineMotion`, `retime`, `gpuTransform` and `cssTransition` live in the server-safe `./utils` entry.

The subpath table below maps the previous build's layout. In it, the `./design` paths correspond to 3.1.0's `./ui`.

## Requirements

- Node `>=22` (see `engines` in `package.json`).
- React and React DOM `>=19.2.0` (peer dependencies; 3.x accepted `>=19.0.0`). 3.2 uses `useEffectEvent`, which is stable only from React 19.2. If you are on React 19.0 or 19.1, upgrade `react` and `react-dom` first.

## Subpath changes

| 3.x                                      | 3.2                                           |
| ---------------------------------------- | --------------------------------------------- |
| `.`                                      | `.`                                           |
| `./result`                               | `./result`                                    |
| `./events`                               | `./events`                                    |
| `./utils`                                | `./utils`                                     |
| `./design/recipes`                       | **`./recipes`**                               |
| `./hooks`                                | `./hooks`                                     |
| `./theme`                                | `./theme`                                     |
| `./design`                               | **`./ui`**                                    |
| `./kernel`                               | `./kernel`                                    |
| `./error`                                | `./error`                                     |
| `./provider`                             | `./provider`                                  |
| `./modules`                              | `./modules`                                   |
| `./dock` ... `./navigation` (10 modules) | unchanged                                     |
| `./ambient/server`, `./ambient/worker`   | unchanged                                     |
| `./modules/*`                            | **removed** (use `./<module>` or `./modules`) |

Notes:

- `./ui` exports only the UI components and `UiProvider`. For convenience it also re-exports `./recipes`, which 3.x served from `./design`.
- `getOrCreateGlobalContext` is still re-exported from `./kernel`.

## Removed names

| Removed                                              | Replacement                                                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `useModuleTheme` (from `./theme` and `.`)            | `useTheme`, same signature and behaviour                                                                  |
| `useIsomorphicLayoutEffect` (from `./hooks` and `.`) | `useLayoutEffect` from `react`. React 19 no longer warns about `useLayoutEffect` during server rendering. |

## Fixed

- The YouTube background's companion audio volume now falls back to `1` when the video's volume is unset. In 3.x the fallback never applied, because `Number(video.volume) ?? 1` ignores `NaN`.

## Components that are no longer `memo()`

These public components were wrapped in `React.memo` in 3.x and are now plain function components:

- `DockCardBanner`, `DockCardHeader`, `DockDescription`, `DockIcon`, `DockTitle` (from `./dock`)
- `YouTubeBackgroundPlayer` (from `./background`)

Rendering is the same. What changes:

- Their type is a function component, not `MemoExoticComponent`. Code that names the type (`typeof DockTitle` with `.type`, `MemoExoticComponent<…>`) needs updating.
- They re-render with their parent. The published build compiles them with the React Compiler, which skips work when props are unchanged. If you bundle the source without the compiler and relied on the memo, wrap them yourself: `const MemoTitle = memo(DockTitle)`.

## React Compiler and bundle size

The published JavaScript is built with `babel-plugin-react-compiler`. Components and hooks memoize automatically, so the source no longer carries most hand-written `useMemo`/`useCallback`/`memo`. Behaviour does not depend on the compiler: identities that effects, subscriptions, context values and public hook returns rely on stay stable in uncompiled code too.

The compiled output is larger. Total gzipped JavaScript is about 35% above the previous build (about 273 KB vs 201 KB across all entries and chunks). The compiler accounts for most of that, about 25%. Bundlers still tree-shake per entry, so an app pays only for the entries it imports.

## Tooltip without Radix (3.2.2)

`Tooltip` and `TooltipProvider` no longer wrap `@radix-ui/react-tooltip`; placement, delay groups and presence are built in. `@radix-ui/react-tooltip`, `clsx` and `loading-dev` are no longer dependencies, so a fresh install pulls less. The public props are the same except:

- `contentProps` takes plain `div` attributes and `data-*` hooks. Radix-only props (`onEscapeKeyDown`, `onPointerDownOutside`, `avoidCollisions`, `forceMount`, `asChild`, `hideWhenDetached`, `sticky`) are gone; flipping and shifting into the viewport always apply.
- CSS variables are renamed: `--radix-tooltip-content-transform-origin` → `--tooltip-transform-origin`, `--radix-tooltip-content-available-width/height` → `--tooltip-available-width/height`, `--radix-tooltip-trigger-width/height` → `--tooltip-trigger-width/height`.
- The portal wrapper is `[data-tooltip-wrapper]` (was `[data-radix-popper-content-wrapper]`). It still copies the content's `z-index`.
- `data-state` (`delayed-open`, `instant-open`, `closed`) and `data-side` keep their values; `data-align` is new, and so is the `align` prop (`start`, `center`, `end`).
- A `TooltipProvider` is optional. A `Tooltip` outside one uses a shared default group (700 ms delay, 300 ms skip window).
- `ClassValue` from `clsx` is no longer re-exported through `cn`'s types; `cn` takes the framework's `Classes` type, which accepts the same strings, arrays, objects and falsy values.

The modal overlay now loads with `React.lazy` instead of `next/dynamic`, mounts only after the first modal opens, and preloads its chunk when the browser is idle.
