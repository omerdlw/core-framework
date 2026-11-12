# Migrating from 5.x to 6.0

6.0 reorganises the package into layers and tidies the public surface. Runtime behaviour is unchanged; what changes is where you import from and a few removed names.

## Requirements

- Node `>=22` (see `engines` in `package.json`).
- React and React DOM `>=19.2.0` (peer dependencies; 5.x accepted `>=19.0.0`). 6.0 uses `useEffectEvent`, which is stable only from React 19.2. If you are on React 19.0 or 19.1, upgrade `react` and `react-dom` first.

## Subpath changes

| 5.x                                      | 6.0                                           |
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

- `./ui` exports only the UI components and `UiProvider`. For convenience it also re-exports `./recipes`, which 5.x served from `./design`.
- `getOrCreateGlobalContext` is still re-exported from `./kernel`.

## Removed names

| Removed                                      | Replacement                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `useModuleTheme` (from `./theme`)            | `useTheme`, same signature and behaviour                                                                  |
| `useIsomorphicLayoutEffect` (from `./hooks`) | `useLayoutEffect` from `react`. React 19 no longer warns about `useLayoutEffect` during server rendering. |
