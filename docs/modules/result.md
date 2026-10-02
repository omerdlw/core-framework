# Result — `@omerdlw/base-framework/result`

> **Read this first if you need to:** write a Server Action (or any function that crosses the network), handle success/failure without `try/catch`, validate input in one place, or understand how failures reach the user.

## 1. At a glance

|                 |                                                                                                                                                                   |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import**      | `import { ok, err, type Result, createSafeAction } from "@omerdlw/base-framework/result"`                                                                                          |
| **Layer**       | `src/core` foundation. **Server-safe**: no React, no `next/*`; imports only `@omerdlw/base-framework/utils` (`UserError`, `toUserMessage`, `report`).                              |
| **Enforced by** | [Rule 6](../architecture-and-rules.md#rule-6-result-pattern-returns): Server Actions (`"use server"`) must return `Result<T, E>`. Never throw across the network. |
| **Tests**       | `tests/core/result.test.ts`                                                                                                                                       |

## 2. Why

Next.js serializes thrown errors poorly and strips their details in production. A returned `Result` arrives intact and forces the caller to handle both branches:

```ts
type Result<T, E = string> =
  | { success: true; data: T; code?: string }
  | { success: false; error: E; code?: string };
```

`data` exists only on success and `error` only on failure (`never` on the other branch), so TypeScript narrows on `result.success`.

## 3. Quick start

```ts
"use server";
import { ok, err, type Result } from "@omerdlw/base-framework/result";
import { UserError, toUserMessage } from "@omerdlw/base-framework/utils";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

export async function renameProjectAction(
  id: string,
  name: string,
): Promise<Result<{ id: string }>> {
  if (!name.trim()) return err("Name is required", "VALIDATION");
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("projects")
      .update({ name })
      .eq("id", id);
    if (error) throw new UserError("Couldn't rename this project"); // shown as written
    return ok({ id });
  } catch (e) {
    return err(toUserMessage(e, { fallback: "Couldn't rename this project" })); // never e.message
  }
}
```

```ts
// Same guarantees, less boilerplate
export const renameProject = createSafeAction(
  async (input: { id: string; name: string }) => updateProject(input), // may throw; may return a Result or a plain value
  { schema: RenameSchema, errorCode: "RENAME_FAILED" },
);
```

```tsx
// Client: branch explicitly, or let toast.fromResult handle feedback
const result = await renameProjectAction(id, name);
if (isErr(result)) return; // result.error is user-safe text
toast.fromResult(result, { success: "Project renamed successfully!" }); // see notification.md
```

## 4. API

| Export                                                        | Signature                                    | Description                                                                                                                                          |
| :------------------------------------------------------------ | :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Result<T, E = string>`, `SuccessResult<T>`, `ErrorResult<E>` | types                                        | `readonly` fields; both carry an optional `code`.                                                                                                    |
| `ok(data, code?)`                                             | `→ SuccessResult<T>`                         | `code` is included only when given.                                                                                                                  |
| `err(error, code?)`                                           | `→ ErrorResult<E>`                           |                                                                                                                                                      |
| `isResult(value)`                                             | `(unknown) → value is Result`                | True for objects with a boolean `success` **and** a matching `data` (success) / `error` (failure) key. Used by `toast.promise` and `toast.fromResult`.  |
| `isOk(r)`, `isErr(r)`                                         | type guards                                  |                                                                                                                                                      |
| `unwrap(r)`                                                   | `→ T`                                        | Returns `data`, or **throws** (the error itself if it is an `Error`, otherwise `new Error(String(error))`). Trusted internal code only.              |
| `unwrapOr(r, fallback)`                                       | `→ T`                                        | `data` or the fallback.                                                                                                                              |
| `map(r, fn)`, `mapErr(r, fn)`                                 | `→ Result`                                   | Transform one branch; `code` is preserved.                                                                                                           |
| `match(r, { ok, err })`                                       | `→ R`                                        | Branch handling returning a value.                                                                                                                   |
| `tryCatch(promiseOrFn, mapError?)`                            | `→ Promise<Result<T, E>>`                    | Awaits a promise (or an async function); thrown/rejected → `err(...)`.                                                                               |
| `createSafeAction(handler, options?)`                         | `→ (...args) => Promise<Result<TOutput, E>>` | See below.                                                                                                                                           |

### 4.1 How thrown errors become messages

`tryCatch` and `createSafeAction` convert a caught error with `mapError(error)` if you pass one, otherwise `toUserMessage(error)`:

- a `UserError`, a string, or a 4xx payload from our own API is used **as written**;
- anything else maps to a fixed sentence from `USER_MESSAGES` (`generic`, `network`, `timeout`, `unauthorized`, `forbidden`, `notFound`, `rateLimited`, `server`) so database/SDK wording never reaches the UI;
- unless it is a `UserError`, the original error is **reported** via `report("Result", error)` (see [error-boundary.md](./error-boundary.md#7-user-facing-messages-and-report)).

### 4.2 `createSafeAction(handler, options)`

| Option              | Meaning                                                                                                                                                                                                                     |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`            | Anything with `safeParse(input)` (e.g. Zod). Applied to the **first argument**; on success the parsed value replaces it. Failure → `err(firstIssueMessage \| message \| "Invalid input", errorCode ?? "VALIDATION_ERROR")`. |
| `validate(...args)` | Extra synchronous check on the (parsed) args. Return an `ErrorResult` to fail with it, `false` → `"Validation failed"`, a non-empty string → that message, anything else passes.                                            |
| `mapError(error)`   | Maps both validation messages and thrown errors to your error type `E`.                                                                                                                                                     |
| `errorCode`         | `code` set on failures (validation default: `"VALIDATION_ERROR"`).                                                                                                                                                          |

The handler may return a `Result` (returned as is), or a plain value (wrapped in `ok(value)`), or throw (→ `err`). The wrapper itself never throws.

## 5. Where Results flow

| Consumer                             | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :----------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toast.fromResult` / `toast.promise` | Toasts `success(data)` or `error` (falling back to `toUserMessage`).                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Notification module                  | Shows `APP_ERROR` / `STATE_CHANGE` events that have `notify: true`.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Dock                                 | Shows **every** `APP_ERROR` as its error status card (regardless of `notify`).                                                                                                                                                                                                                                                                                                                                                                                                          |

So a failed `useServerAction` produces a dock error card, plus a toast if you passed `toast: true`.

## 6. Recipes and gotchas

| I want to…                   | Do this                                                                                               |
| :--------------------------- | :---------------------------------------------------------------------------------------------------- |
| Return a validation error    | `return err("Name is required", "VALIDATION")`.                                                       |
| Show server text to the user | Throw `new UserError("…")` (or return `err("…")`) with text you wrote; never forward `error.message`. |
| Custom error shape           | `Result<T, MyError>` and pass `mapError` to `createSafeAction` / `tryCatch`.                          |
| Narrow in TypeScript         | `if (r.success) r.data else r.error`, or `isOk` / `isErr`.                                            |
| Chain transformations        | `map(r, fn)` / `mapErr(r, fn)`.                                                                       |

- A Server Action must return plain serializable data: do not put `Error` instances, class instances or functions in a `Result` that crosses the network.
- `unwrap` throws: never use it in a `"use server"` function's return path.
- `createSafeAction`'s `schema` validates only the **first** argument.
- `isResult` requires the matching data/error key: `{ success: true }` without `data` is **not** a Result (use `ok(undefined)`).

## 7. File map

A single file, `src/core/result.ts`. It depends only on `./utils/user-message` and `./utils/report`, so it is safe on both server and client (and is one of the server-safe core entries that must not import React or `next/*`).

## 8. Dependencies

- **Uses:** `@omerdlw/base-framework/utils` (`UserError`, `toUserMessage`, `report`) only.
- **Used by:** every `server/actions.ts` in `src/features/**`, `@omerdlw/base-framework/hooks` (`useServerAction`, `useAsyncAction`), `@omerdlw/base-framework/modules/notification` (`isResult` for `toast.fromResult` / `promise`), and route-level helpers that return `Result`.
