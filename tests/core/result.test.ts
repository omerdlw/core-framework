import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ok,
  err,
  isResult,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  mapErr,
  match,
  tryCatch,
  createSafeAction,
} from "../../src/core/result.ts";
import { USER_MESSAGES, UserError } from "../../src/core/utils/user-message.ts";

test("ok() creates a valid SuccessResult", () => {
  const result = ok({ id: 123 }, "CUSTOM_CODE");
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { id: 123 });
  assert.equal(result.code, "CUSTOM_CODE");
  assert.equal(result.error, undefined);
  assert.ok(isResult(result));
  assert.ok(isOk(result));
  assert.ok(!isErr(result));
});

test("err() creates a valid ErrorResult", () => {
  const result = err("Not found", "NOT_FOUND");
  assert.equal(result.success, false);
  assert.equal(result.error, "Not found");
  assert.equal(result.code, "NOT_FOUND");
  assert.equal(result.data, undefined);
  assert.ok(isResult(result));
  assert.ok(isErr(result));
  assert.ok(!isOk(result));
});

test("isResult() accurately distinguishes Result objects from arbitrary values", () => {
  assert.ok(isResult(ok("valid")));
  assert.ok(isResult(err("error")));
  assert.ok(!isResult(null));
  assert.ok(!isResult(undefined));
  assert.ok(!isResult("string"));
  assert.ok(!isResult(123));
  assert.ok(!isResult({}));
  assert.ok(!isResult({ success: true }));
  assert.ok(!isResult({ success: false }));
});

test("unwrap() returns data on success and throws on error", () => {
  assert.equal(unwrap(ok("hello")), "hello");
  assert.throws(
    () => unwrap(err("failed")),
    (error) => error instanceof Error && error.message === "failed",
  );
  const customError = new Error("custom error instance");
  assert.throws(
    () => unwrap(err(customError)),
    (error) => error === customError,
  );
});

test("unwrapOr() returns data on success and fallback on error", () => {
  assert.equal(unwrapOr(ok("original"), "fallback"), "original");
  assert.equal(unwrapOr(err("failure"), "fallback"), "fallback");
});

test("map() transforms success data and passes errors through", () => {
  const success = ok(10);
  const mappedSuccess = map(success, (n) => n * 2);
  assert.ok(isOk(mappedSuccess));
  assert.equal(mappedSuccess.data, 20);

  const failure = err("original error");
  const mappedFailure = map(failure, (n) => n! * 2);
  assert.ok(isErr(mappedFailure));
  assert.equal(mappedFailure.error, "original error");
});

test("mapErr() transforms error and passes success data through", () => {
  const failure = err("invalid input", "BAD_REQUEST");
  const mappedFailure = mapErr(failure, (msg) => `Error: ${msg}`);
  assert.ok(isErr(mappedFailure));
  assert.equal(mappedFailure.error, "Error: invalid input");
  assert.equal(mappedFailure.code, "BAD_REQUEST");

  const success = ok("all good");
  const mappedSuccess = mapErr(success, (msg) => `Error: ${msg}`);
  assert.ok(isOk(mappedSuccess));
  assert.equal(mappedSuccess.data, "all good");
});

test("match() executes the correct branch for ok and err", () => {
  const successBranch = match(ok(42), {
    ok: (val) => `Success: ${val}`,
    err: (e) => `Error: ${e}`,
  });
  assert.equal(successBranch, "Success: 42");

  const errorBranch = match(err("network timeout"), {
    ok: (val) => `Success: ${val}`,
    err: (e) => `Error: ${e}`,
  });
  assert.equal(errorBranch, "Error: network timeout");
});

test("tryCatch() catches async rejections into Result", async () => {
  const successfulPromise = tryCatch(async () => 100);
  const resSuccess = await successfulPromise;
  assert.ok(isOk(resSuccess));
  assert.equal(resSuccess.data, 100);

  const failingPromise = tryCatch(async () => {
    throw new Error("DB connection failed");
  });
  const resFailure = await failingPromise;
  assert.ok(isErr(resFailure));
  assert.equal(resFailure.error, USER_MESSAGES.generic);

  const userFailure = await tryCatch(async () => {
    throw new UserError("That username is already taken");
  });
  assert.equal(userFailure.error, "That username is already taken");

  const customMapped = await tryCatch(
    async () => {
      throw new Error("unauthorized");
    },
    (e) => `CUSTOM: ${(e as any).message}`,
  );
  assert.ok(isErr(customMapped));
  assert.equal(customMapped.error, "CUSTOM: unauthorized");
});

test("createSafeAction() wraps raw returns, Result returns, validation, and thrown errors", async () => {
  const rawAction = createSafeAction(async (name) => ({
    greeting: `Hello, ${name}`,
  }));
  const rawRes = await rawAction("Base");
  assert.ok(isOk(rawRes));
  assert.deepEqual(rawRes.data, { greeting: "Hello, Base" });

  const schemaAction = createSafeAction(
    async (data) => ({ saved: (data as any).title }),
    {
      schema: {
        safeParse: (input) => {
          if (
            !input ||
            typeof (input as any).title !== "string" ||
            (input as any).title.trim().length < 3
          ) {
            return {
              success: false,
              error: {
                issues: [{ message: "Title must be at least 3 chars" }],
              },
            };
          }
          return {
            success: true,
            data: { title: (input as any).title.trim() },
          };
        },
      },
    },
  );

  const invalidRes = await schemaAction({ title: "ab" });
  assert.ok(isErr(invalidRes));
  assert.equal(invalidRes.error, "Title must be at least 3 chars");
  assert.equal(invalidRes.code, "VALIDATION_ERROR");

  const validRes = await schemaAction({ title: "  Clean Architecture  " });
  assert.ok(isOk(validRes));
  assert.deepEqual(validRes.data, { saved: "Clean Architecture" });

  const throwingAction = createSafeAction(
    async () => {
      throw new Error("Database timeout");
    },
    { errorCode: "DB_ERR" },
  );
  const errRes = await throwingAction();
  assert.ok(isErr(errRes));
  assert.equal(errRes.error, USER_MESSAGES.generic);
  assert.equal(errRes.code, "DB_ERR");
});
