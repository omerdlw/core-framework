import { UserError, toUserMessage } from "@/foundation/utils/user-message";
import { report } from "@/foundation/utils/report";

export interface SuccessResult<T> {
  readonly code?: string;
  readonly data: T;
  readonly error?: never;
  readonly success: true;
}

export interface ErrorResult<E = string> {
  readonly code?: string;
  readonly data?: never;
  readonly error: E;
  readonly success: false;
}

export type Result<T, E = string> = SuccessResult<T> | ErrorResult<E>;

export function ok<T>(data: T, code?: string): SuccessResult<T> {
  return { data, success: true, ...(code ? { code } : {}) };
}

export function err<E = string>(error: E, code?: string): ErrorResult<E> {
  return { error, success: false, ...(code ? { code } : {}) };
}

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

export function isOk<T, E = string>(
  result: Result<T, E>,
): result is SuccessResult<T> {
  return result.success === true;
}

export function isErr<T, E = string>(
  result: Result<T, E>,
): result is ErrorResult<E> {
  return result.success === false;
}

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

export function unwrapOr<T, E = string>(result: Result<T, E>, fallback: T): T {
  return result.success ? result.data : fallback;
}

export function map<T, U, E = string>(
  result: Result<T, E>,
  fn: (data: T) => U,
): Result<U, E> {
  return result.success ? ok(fn(result.data), result.code) : result;
}

export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  return result.success ? result : err(fn(result.error), result.code);
}

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

export interface SafeActionOptions<TArgs extends unknown[], E = string> {
  errorCode?: string;
  mapError?: (error: unknown) => E;
  schema?: SafeActionSchema<TArgs[0]>;
  validate?: (
    ...args: TArgs
  ) => Result<unknown, E> | string | boolean | null | undefined;
}

export function createSafeAction<TArgs extends unknown[], TOutput, E = string>(
  handler: (
    ...args: TArgs
  ) => Promise<Result<TOutput, E> | TOutput> | Result<TOutput, E> | TOutput,
  options: SafeActionOptions<TArgs, E> = {},
): (...args: TArgs) => Promise<Result<TOutput, E>> {
  const { errorCode, mapError, schema, validate } = options;

  return async (...args: TArgs): Promise<Result<TOutput, E>> => {
    try {
      let effectiveArgs = args;

      if (schema) {
        const parsed = schema.safeParse(args[0]);
        if (!parsed.success) {
          const issueMessage =
            parsed.error?.issues?.[0]?.message ||
            parsed.error?.message ||
            "Invalid input";
          return err(
            // Without mapError the issue message stands in for E, by contract.
            mapError ? mapError(issueMessage) : (issueMessage as unknown as E),
            errorCode ?? "VALIDATION_ERROR",
          );
        }
        effectiveArgs = [parsed.data, ...args.slice(1)] as TArgs;
      }

      if (validate) {
        const validationResult = validate(...effectiveArgs);
        if (isResult(validationResult)) {
          if (isErr(validationResult)) {
            return validationResult;
          }
        } else if (validationResult === false) {
          return err(
            mapError
              ? mapError("Validation failed")
              : // Without mapError the default message stands in for E, by contract.
                ("Validation failed" as unknown as E),
            errorCode ?? "VALIDATION_ERROR",
          );
        } else if (
          typeof validationResult === "string" &&
          validationResult.length > 0
        ) {
          return err(
            mapError
              ? mapError(validationResult)
              : // Without mapError the raw validation result stands in for E, by contract.
                (validationResult as unknown as E),
            errorCode ?? "VALIDATION_ERROR",
          );
        }
      }

      const output = await handler(...effectiveArgs);
      if (isResult(output)) {
        return output;
      }
      return ok(output as TOutput);
    } catch (error) {
      return err(mapCaught(error, mapError), errorCode);
    }
  };
}
