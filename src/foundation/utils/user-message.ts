/**
 * Default user-facing messages for common failure kinds.
 */
export const USER_MESSAGES = Object.freeze({
  generic: "Something went wrong. Please try again",
  network: "You appear to be offline. Check your connection and try again",
  timeout: "That took too long. Please try again",
  unauthorized: "Your session has expired. Please sign in again",
  forbidden: "You don't have permission to do that",
  notFound: "We couldn't find what you were looking for",
  rateLimited: "Too many attempts. Please wait a moment and try again",
  server: "We're having trouble on our end. Please try again in a moment",
} as const);

/**
 * An error whose message is safe to show to the user as-is.
 */
export class UserError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "UserError";
    this.status = status;
  }
}

/**
 * Options for `toUserMessage`: a fallback text and per-code messages.
 */
export interface UserMessageOptions {
  fallback?: string;
  codes?: Readonly<Record<string, string>>;
}

const NETWORK_FAILURE = /failed to fetch|network|load failed|fetch failed/i;

const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_REQUEST_TIMEOUT = 408;
const STATUS_RATE_LIMITED = 429;
const STATUS_GATEWAY_TIMEOUT = 504;
const STATUS_CLIENT_ERROR_MIN = 400;
const STATUS_SERVER_ERROR_MIN = 500;

function readField<T>(
  source: unknown,
  field: string,
  type: "string" | "number",
): T | undefined {
  const value = (source as Record<string, unknown> | null)?.[field];
  return typeof value === type ? (value as T) : undefined;
}

function readPayloadMessage(error: unknown): string | undefined {
  const payload = (error as { payload?: unknown } | null)?.payload;
  const message = readField<string>(payload, "error", "string")?.trim();
  return message || undefined;
}

function messageForStatus(
  status: number | undefined,
  error: unknown,
  fallback: string,
): string | undefined {
  if (status === undefined) return undefined;
  if (status === STATUS_UNAUTHORIZED) return USER_MESSAGES.unauthorized;
  if (status === STATUS_RATE_LIMITED) return USER_MESSAGES.rateLimited;
  if (status === STATUS_REQUEST_TIMEOUT || status === STATUS_GATEWAY_TIMEOUT) {
    return USER_MESSAGES.timeout;
  }
  if (status >= STATUS_SERVER_ERROR_MIN) return USER_MESSAGES.server;
  if (status < STATUS_CLIENT_ERROR_MIN) return undefined;

  const authored = readPayloadMessage(error);
  if (authored) return authored;
  if (status === STATUS_FORBIDDEN) return USER_MESSAGES.forbidden;
  if (status === STATUS_NOT_FOUND) return USER_MESSAGES.notFound;
  return fallback;
}

function isNetworkFailure(error: unknown): boolean {
  const isOffline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  if (isOffline) return true;
  return (
    NETWORK_FAILURE.test((error as Error).message ?? "") &&
    (error instanceof TypeError || /fetch/i.test((error as Error).name))
  );
}

/**
 * Turns any thrown value into a message that is safe to show to a user.
 */
export function toUserMessage(
  error: unknown,
  { codes, fallback = USER_MESSAGES.generic }: UserMessageOptions = {},
): string {
  if (typeof error === "string") return error.trim() || fallback;
  if (!error || typeof error !== "object") return fallback;

  if (error instanceof UserError) {
    if (error.status === STATUS_UNAUTHORIZED) {
      return USER_MESSAGES.unauthorized;
    }
    return error.message || fallback;
  }
  if ((error as { name?: string }).name === "AbortError") return fallback;

  const code = readField<string>(error, "code", "string");
  if (code && codes?.[code]) return codes[code];

  const fromStatus = messageForStatus(
    readField<number>(error, "status", "number"),
    error,
    fallback,
  );
  if (fromStatus !== undefined) return fromStatus;

  return isNetworkFailure(error) ? USER_MESSAGES.network : fallback;
}
