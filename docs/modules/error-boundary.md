# Error Boundary — `@omerdlw/base-framework/error`

> **Read this first if you need to:** stop one crash from taking down the app, wrap a risky widget, send errors to Sentry (or another sink), or understand how a runtime error becomes the dock's error card.

## 1. At a glance

|                  |                                                                                                                                                           |
| :--------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import**       | `import { ComponentError, getErrorReporter, … } from "@omerdlw/base-framework/error"`                                                                                      |
| **Layer**        | `src/core` (frozen upstream). Client-only (`"use client"`).                                                                                               |
| **Installed by** | `CoreProvider`: `GlobalError` wraps everything, `ModuleError` is the boundary around every module backdrop/overlay, `GlobalErrorListener` is mounted once |
| **Emits**        | `EVENT_TYPES.APP_ERROR` (`{ error, errorInfo?, message, resetError? }`)                                                                                   |
| **Theme**        | `errorTheme` slots `screen`, `icon`, `title`, `retryButton` (`src/config/error.core.theme.ts`)                                                            |
| **Tests**        | `tests/core/error.test.ts`                                                                                                                                |

## 2. Mental model

```
render error ──▶ nearest boundary (Component < Module < Global)
                   ├─ onError(error, info, context)                (your hook)
                   ├─ globalEvents.emit(APP_ERROR, …)  unless silent   → dock shows its error card
                   ├─ ErrorReporter.captureError(error, context)       → handlers (console / Sentry / yours)
                   └─ renders the fallback (default card with "Try again")

window "error" / "unhandledrejection" ──▶ GlobalErrorListener (filtered, throttled)
                   ├─ ErrorReporter.captureError
                   └─ globalEvents.emit(APP_ERROR)

report(scope, error) anywhere ──▶ the reporter sink installed by GlobalErrorListener
```

Boundaries are **class components** (React requires it) configured through props. Raw `Error.message` values never reach the UI: the displayed text is a fixed copy or `toUserMessage(error)`.

## 3. Quick start

```tsx
// Inline: a failing widget degrades to a small card with "Try again"
<ComponentError message="Chart failed to load">
  <RevenueChart />
</ComponentError>

// Custom fallback (render prop)
<ComponentError fallback={({ error, resetError }) => <MyEmpty onRetry={resetError} />}>…</ComponentError>

// Reset when a key changes (e.g. the selected id) and observe errors
<ErrorBoundaryCore resetKey={id} variant="inline" onError={(e, info, ctx) => track(ctx.route)}>…</ErrorBoundaryCore>
```

```ts
// Wire a reporting sink once, e.g. in an app-level client component
import * as Sentry from "@sentry/nextjs";
getErrorReporter({ sampleRate: 0.5 })
  .addHandler(createSentryHandler(Sentry))
  .setContext("release", process.env.NEXT_PUBLIC_RELEASE)
  .setTag("app", "web");
```

## 4. Boundaries

| Component           | Variant  | Fallback copy                                                    | Resets when                                   | Notes                                                                                                                                        |
| :------------------ | :------- | :--------------------------------------------------------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `GlobalError`       | `full`   | "We ran into an unexpected problem. Please try again"            | the **pathname** changes (and on "Try again") | Outermost; also emits `APP_ERROR`.                                                                                                           |
| `ModuleError`       | `module` | "This part of the app isn't working right now. Please try again" | "Try again"                                   | Used by `ModuleHost` around every module's backdrop and overlay and by `ModuleBoundary`; `name` identifies the module in the report context. |
| `ComponentError`    | `inline` | `message` or "This section couldn't be loaded. Please try again" | "Try again"                                   | For widgets.                                                                                                                                 |
| `ErrorBoundaryCore` | any      | `message` / `toUserMessage(error)`                               | "Try again" or when `resetKey` changes        | The shared implementation.                                                                                                                   |

`ErrorBoundaryCore` props:

| Prop                            | Meaning                                                                        |
| :------------------------------ | :----------------------------------------------------------------------------- |
| `fallback`                      | A node, or `({ error, resetError }) => node`.                                  |
| `message`, `title`              | Default-card text; `title` and `name` are also recorded in the report context. |
| `name`, `variant`               | Reported as context (`name`, `variant`).                                       |
| `resetKey`                      | When it changes the boundary clears its error state.                           |
| `onError(error, info, context)` | Called first; exceptions inside it are caught and logged as warnings.          |
| `onReset`                       | Called after "Try again" / `resetError()`.                                     |
| `silent`                        | Do **not** emit `APP_ERROR` (no dock card); the reporter is still called.      |

The `context` passed to `onError` and the reporter: `{ componentStack, route, userAgent, timestamp, name, variant, source: "ErrorBoundary" }`.

## 5. `GlobalErrorListener`

Mounted once by `CoreProvider`. It listens to `window` `error` and `unhandledrejection`, then:

1. **Ignores** noise (`shouldIgnoreError`): empty errors, Next.js not-found errors, and messages matching `ResizeObserver loop`, `Network request failed`, `Loading chunk`, `Unexpected end of input`, `Failed to fetch`, `Script error`, `HTTP 404`.
2. **Throttles:** at most **10 errors** per page lifetime, at least **2 s** apart, and each distinct message **once**.
3. Sends the error to the reporter (`source: "window.onerror" | "unhandledrejection"`) and emits `APP_ERROR` with `message: toUserMessage(error)`.

It also installs the reporter as the **sink** of `report()` (below).

## 6. `ErrorReporter`

`getErrorReporter(options?)` returns a **singleton** (options apply on the first call only).

| Option               | Default   | Meaning                                                                                                                                                               |
| :------------------- | :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`            | `true`    | Master switch.                                                                                                                                                        |
| `sampleRate`         | `1`       | 0–1 probability per capture.                                                                                                                                          |
| `deduplicateWindow`  | 60 000 ms | A report with the same **fingerprint** (`componentStack top :: message[0..100] :: name :: route`) is dropped inside the window; at most 100 fingerprints are tracked. |
| `beforeSend(report)` | —         | Return a changed report, or `null` to drop it.                                                                                                                        |

Methods: `addHandler({ name, handle })`, `removeHandler(name)`, `setContext(key, value)` (max 10 keys), `setTag(key, value)`, `captureError(error, extraContext?)` → `ErrorReport | undefined`, `captureMessage(message, level?, context?)`.

Default handlers are added lazily in the browser **only if you have not added any**: a console handler (silent in production) and a Sentry handler when `window.Sentry` exists. `createSentryHandler(Sentry)` falls back to the console handler when the object lacks `captureException` / `withScope`; it sets fingerprint, user, tags, `environment` and `custom` contexts and the component stack. Handler exceptions are swallowed.

`ErrorReport`: `{ error: { name, message, stack }, fingerprint, timestamp, environment (route, url, userAgent, platform, language, online), componentStack, context, tags, user? }`.

## 7. User-facing messages and `report()`

Raw `Error.message` values (database, SDK, vendor wording) never reach the UI. `toUserMessage(error, { fallback?, codes? })` from `@omerdlw/base-framework/utils` is the single gate: only a `UserError`, a string `Result` error, or a 4xx payload from our own API is shown as written; everything else maps to a fixed sentence in `USER_MESSAGES` (`generic`, `network`, `timeout`, `unauthorized`, `forbidden`, `notFound`, `rateLimited`, `server`). Server code throws `UserError` for validation/permission text it wants shown; route handlers answer with `apiErrorResponse` from `@/infrastructure/http/api-error`.

`report(scope, error, level?)` from `@omerdlw/base-framework/utils` replaces `console.*` everywhere. On the client, `GlobalErrorListener` installs the reporter as the sink; without a sink, browsers stay silent in production and servers always log. Only the reporter's dev-only console handler touches `console`.

## 8. Public API

| Export                                                                                                                                                                                                 | Kind            | Description                                                                                                                                                                   |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GlobalError`, `ModuleError`, `ComponentError`                                                                                                                                                         | components      | The three boundaries (§4).                                                                                                                                                    |
| `ErrorBoundaryCore`                                                                                                                                                                                    | class component | Shared implementation.                                                                                                                                                        |
| `GlobalErrorListener`                                                                                                                                                                                  | component       | Window error/rejection listener (§5).                                                                                                                                         |
| `getErrorReporter(options?)`                                                                                                                                                                           | factory         | Singleton reporter (§6).                                                                                                                                                      |
| `createConsoleHandler()`, `createSentryHandler(Sentry)`                                                                                                                                                | factories       | Sinks.                                                                                                                                                                        |
| `createReport`, `createErrorContext`, `fingerprint`, `getErrorMessage`, `shouldIgnoreError`, `getBrowserEnvironment`, `normalizeSampleRate`, `normalizeDedupeWindow`, `getRuntimePath`, `getUserAgent` | utils           | Report construction and filtering.                                                                                                                                            |
| `ERROR_MESSAGES`, `ERROR_LISTENER_CONFIG`, `DEFAULT_DEDUPE_WINDOW` (60 000), `MAX_CONTEXT` (10), `MAX_FINGERPRINTS` (100), `errorTheme`                                                                | constants       | Copy, limits, theme spec.                                                                                                                                                     |
| Types                                                                                                                                                                                                  |                 | `ErrorReport`, `ErrorReporterHandler`, `ErrorReporterOptions`, `ErrorBoundaryCoreProps`, `ErrorFallbackRender`, `ErrorContextData`, `BrowserEnvironment`, `ErrorThemeSlot`, … |

## 9. Recipes and gotchas

| I want to…                                 | Do this                                                                 |
| :----------------------------------------- | :---------------------------------------------------------------------- |
| Isolate a risky widget                     | `<ComponentError>`.                                                     |
| Handle an error myself without a dock card | `<ErrorBoundaryCore silent onError={…}>`.                               |
| Send errors to Sentry                      | `getErrorReporter().addHandler(createSentryHandler(Sentry))`.           |
| Report a handled error                     | `report("Checkout", error)` (and keep the UI message user-friendly).    |
| Drop PII before sending                    | `getErrorReporter({ beforeSend: (r) => ({ ...r, user: undefined }) })`. |

- Error boundaries catch **render/lifecycle** errors, not errors in event handlers or async code; those reach the `GlobalErrorListener` (or call `report`).
- `getErrorReporter` ignores options after the first call; configure it once, early.
- The default fallback does not render `title`; it shows `message` (or the mapped user message).
- A `GlobalError` reset on navigation means a crash on one route does not stick to the next.

## 10. File map

| File           | Responsibility                                                                                            |
| :------------- | :-------------------------------------------------------------------------------------------------------- |
| `index.ts`     | Public barrel.                                                                                            |
| `types.ts`     | Report, context, environment, reporter options, boundary props, Sentry scope.                             |
| `constants.ts` | Messages, listener config (limits, ignore patterns), dedupe limits.                                       |
| `utils.ts`     | Fingerprinting, report creation, environment capture, error normalization and ignore rules.               |
| `boundary.tsx` | `ErrorBoundaryCore`, default fallback, `GlobalError`, `ModuleError`, `ComponentError`: the module's view. |
| `listener.ts`  | `GlobalErrorListener`.                                                                                    |
| `reporter.ts`  | `ErrorReporter` (sampling, dedupe, handlers) and sink factories.                                          |
| `theme.ts`     | `errorTheme` spec.                                                                                        |

`builder.ts`, `provider.tsx`, `view.tsx` and `motion.ts` are intentionally absent ([README](./README.md#42-why-some-optional-slots-are-absent)).

## 11. Dependencies

- **Uses:** `@omerdlw/base-framework/events` (`APP_ERROR`), `@omerdlw/base-framework/atoms` (`Button`, `Icon` for the fallback), `@omerdlw/base-framework/theme`, `@omerdlw/base-framework/utils` (`report`, `setReportSink`, `toUserMessage`), `next/navigation` (`usePathname`).
- **Used by:** `src/core/provider.tsx`; the dock (turns `APP_ERROR` into its error status) and the notification module (toasts `APP_ERROR` with `notify: true`) react to the event without importing this module.
