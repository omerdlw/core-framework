import { report } from "@/foundation/utils/report";
import { toUserMessage, UserError } from "@/foundation/utils/user-message";

/**
 * The success branch of a `Result`.
 */
export interface SuccessResult<T> {
  readonly code?: string;
  readonly data: T;
  readonly error?: never;
  readonly success: true;
}

/**
 * The failure branch of a `Result`.
 */
export interface ErrorResult<E = string> {
  readonly code?: string;
  readonly data?: never;
  readonly error: E;
  readonly success: false;
}

/**
 * A value that is either a success with data or a failure with an error.
 */
export type Result<T, E = string> = SuccessResult<T> | ErrorResult<E>;

/**
 * Creates a success result.
 */
export function ok<T>(data: T, code?: string): SuccessResult<T> {
  return { data, success: true, ...(code ? { code } : {}) };
}

/**
 * Creates a failure result.
 */
export function err<E = string>(error: E, code?: string): ErrorResult<E> {
  return { error, success: false, ...(code ? { code } : {}) };
}

/**
 * True when a value has the shape of a `Result`.
 */
export function isResult(value: unknown): value is Result<unknown, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof value.success === "boolean" &&
    (("data" in value && (value as { success: boolean }).success === true) ||
      ("error" in value && (value as { success: boolean }).success === false))
  );
}

/**
 * Narrows a result to its success branch.
 */
export function isOk<T, E = string>(
  result: Result<T, E>,
): result is SuccessResult<T> {
  return result.success === true;
}

/**
 * Narrows a result to its failure branch.
 */
export function isErr<T, E = string>(
  result: Result<T, E>,
): result is ErrorResult<E> {
  return result.success === false;
}

/**
 * Returns the data of a success, or throws the error of a failure.
 */
export function unwrap<T, E = string>(result: Result<T, E>): T {
  if (result.success) {
    return result.data;
  }
  if (result.error instanceof Error) {
    throw result.error;
  }
  throw new Error(
    typeof result.error === "string" ? result.error : String(result.error),
  );
}

/**
 * Returns the data of a success, or the fallback for a failure.
 */
export function unwrapOr<T, E = string>(result: Result<T, E>, fallback: T): T {
  return result.success ? result.data : fallback;
}

/**
 * Transforms the data of a success and leaves a failure untouched.
 */
export function map<T, U, E = string>(
  result: Result<T, E>,
  fn: (data: T) => U,
): Result<U, E> {
  return result.success ? ok(fn(result.data), result.code) : result;
}

/**
 * Transforms the error of a failure and leaves a success untouched.
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  return result.success ? result : err(fn(result.error), result.code);
}

/**
 * Runs the branch that matches the result and returns its value.
 */
export function match<T, E, R>(
  result: Result<T, E>,
  branches: { ok: (data: T) => R; err: (error: E) => R },
): R {
  return result.success ? branches.ok(result.data) : branches.err(result.error);
}

function mapCaught<E>(error: unknown, mapError?: (error: unknown) => E): E {
  if (!(error instanceof UserError)) report("Result", error);
  // Without mapError the user message stands in for E, by contract.
  return mapError ? mapError(error) : (toUserMessage(error) as unknown as E);
}

/**
 * Awaits a promise (or function) and returns a result instead of throwing.
 */
export async function tryCatch<T, E = string>(
  promiseOrFn: Promise<T> | (() => Promise<T>),
  mapError?: (error: unknown) => E,
): Promise<Result<T, E>> {
  try {
    const data =
      typeof promiseOrFn === "function"
        ? await promiseOrFn()
        : await promiseOrFn;
    return ok(data);
  } catch (error) {
    return err(mapCaught(error, mapError));
  }
}

interface SafeActionSchema<TParsed> {
  safeParse: (input: unknown) =>
    | { data: TParsed; success: true }
    | {
        error?: {
          issues?: { message?: string }[];
          message?: string;
        };
        success: false;
      };
}

/**
 * Options for `createSafeAction`: schema, validation and error mapping.
 */
export interface SafeActionOptions<TArgs extends unknown[], E = string> {
  errorCode?: string;
  mapError?: (error: unknown) => E;
  schema?: SafeActionSchema<TArgs[0]>;
  validate?: (
    ...args: TArgs
  ) => Result<unknown, E> | string | boolean | null | undefined;
}

const VALIDATION_ERROR_CODE = "VALIDATION_ERROR";
const INVALID_INPUT_MESSAGE = "Invalid input";
const VALIDATION_FAILED_MESSAGE = "Validation failed";

/**
 * Wraps a handler so validation failures and thrown errors become results.
 */
export function createSafeAction<TArgs extends unknown[], TOutput, E = string>(
  handler: (
    ...args: TArgs
  ) => Promise<Result<TOutput, E> | TOutput> | Result<TOutput, E> | TOutput,
  options: SafeActionOptions<TArgs, E> = {},
): (...args: TArgs) => Promise<Result<TOutput, E>> {
  const { errorCode, mapError, schema, validate } = options;

  const validationError = (message: string): ErrorResult<E> =>
    err(
      // Without mapError the message stands in for E, by contract.
      mapError ? mapError(message) : (message as unknown as E),
      errorCode ?? VALIDATION_ERROR_CODE,
    );

  const rejectionOf = (
    outcome: ReturnType<NonNullable<typeof validate>>,
  ): ErrorResult<E> | null => {
    if (isResult(outcome)) return isErr(outcome) ? outcome : null;
    if (outcome === false) return validationError(VALIDATION_FAILED_MESSAGE);
    if (typeof outcome === "string" && outcome.length > 0) {
      return validationError(outcome);
    }
    return null;
  };

  return async (...args: TArgs): Promise<Result<TOutput, E>> => {
    try {
      let effectiveArgs = args;

      if (schema) {
        const parsed = schema.safeParse(args[0]);
        if (!parsed.success) {
          return validationError(
            parsed.error?.issues?.[0]?.message ||
              parsed.error?.message ||
              INVALID_INPUT_MESSAGE,
          );
        }
        effectiveArgs = [parsed.data, ...args.slice(1)] as TArgs;
      }

      const rejection = validate
        ? rejectionOf(validate(...effectiveArgs))
        : null;
      if (rejection) return rejection;

      const output = await handler(...effectiveArgs);
      if (isResult(output)) return output;
      return ok(output as TOutput);
    } catch (error) {
      return err(mapCaught(error, mapError), errorCode);
    }
  };
}
