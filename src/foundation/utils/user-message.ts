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

export class UserError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "UserError";
    this.status = status;
  }
}

export interface UserMessageOptions {
  fallback?: string;
  codes?: Readonly<Record<string, string>>;
}

const NETWORK_FAILURE = /failed to fetch|network|load failed|fetch failed/i;

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

export function toUserMessage(
  error: unknown,
  { codes, fallback = USER_MESSAGES.generic }: UserMessageOptions = {},
): string {
  if (typeof error === "string") return error.trim() || fallback;
  if (!error || typeof error !== "object") return fallback;

  if (error instanceof UserError) {
    if (error.status === 401) return USER_MESSAGES.unauthorized;
    return error.message || fallback;
  }
  if ((error as { name?: string }).name === "AbortError") return fallback;

  const code = readField<string>(error, "code", "string");
  if (code && codes?.[code]) return codes[code];

  const status = readField<number>(error, "status", "number");

  if (status === 401) return USER_MESSAGES.unauthorized;
  if (status === 429) return USER_MESSAGES.rateLimited;
  if (status === 408 || status === 504) return USER_MESSAGES.timeout;
  if (status !== undefined && status >= 500) return USER_MESSAGES.server;

  if (status !== undefined && status >= 400) {
    const authored = readPayloadMessage(error);
    if (authored) return authored;
    if (status === 403) return USER_MESSAGES.forbidden;
    if (status === 404) return USER_MESSAGES.notFound;
    return fallback;
  }

  const isOffline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  if (
    isOffline ||
    (NETWORK_FAILURE.test((error as Error).message ?? "") &&
      (error instanceof TypeError || /fetch/i.test((error as Error).name)))
  ) {
    return USER_MESSAGES.network;
  }

  return fallback;
}
