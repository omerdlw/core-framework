import type { ErrorInfo } from "react";

import { DEFAULT_DEDUPE_WINDOW, ERROR_LISTENER_CONFIG } from "./constants";
import type {
  BrowserEnvironment,
  ErrorContextData,
  ErrorReport,
} from "./types";

const IS_BROWSER = typeof window !== "undefined";
const HAS_NAVIGATOR = typeof navigator !== "undefined";

const FINGERPRINT_MESSAGE_LENGTH = 100;
const FINGERPRINT_SEPARATOR = "::";
const DEFAULT_ERROR_NAME = "UnknownError";
const DEFAULT_BOUNDARY_NAME = "ErrorBoundary";
const DEFAULT_VARIANT = "default";

interface ErrorContextInput {
  errorInfo?: ErrorInfo | null;
  name?: string;
  title?: string;
  variant?: string;
}

interface ReportOptions {
  context?: Record<string, unknown>;
  tags?: Record<string, string>;
}

/**
 * Current location pathname, or null outside a browser.
 */
export const getRuntimePath = (): string | null =>
  IS_BROWSER ? window.location.pathname : null;

/**
 * Current user agent string, or null outside a browser.
 */
export const getUserAgent = (): string | null =>
  HAS_NAVIGATOR ? navigator.userAgent : null;

/**
 * Builds the context metadata attached to an error caught by a boundary.
 */
export function createErrorContext({
  errorInfo,
  name,
  title,
  variant,
}: ErrorContextInput): ErrorContextData {
  return {
    componentStack: errorInfo?.componentStack || null,
    route: getRuntimePath(),
    userAgent: getUserAgent(),
    timestamp: new Date().toISOString(),
    name: name || title || DEFAULT_BOUNDARY_NAME,
    variant: variant || DEFAULT_VARIANT,
    source: DEFAULT_BOUNDARY_NAME,
  };
}

/**
 * Coerces a value to a sample rate between 0 and 1; invalid input becomes 1.
 */
export function normalizeSampleRate(value: unknown): number {
  const sampleRate = Number(value);
  return Number.isFinite(sampleRate) ? Math.min(1, Math.max(0, sampleRate)) : 1;
}

/**
 * Coerces a value to a non-negative de-duplication window in milliseconds.
 */
export function normalizeDedupeWindow(value: unknown): number {
  const dedupeWindow = Number(value);
  return Number.isFinite(dedupeWindow)
    ? Math.max(0, dedupeWindow)
    : DEFAULT_DEDUPE_WINDOW;
}

/**
 * Captures route, URL, user agent, platform, language and online state.
 */
export function getBrowserEnvironment(
  route?: string | null,
): BrowserEnvironment {
  return {
    route: route || (IS_BROWSER ? window.location.pathname : null),
    userAgent: HAS_NAVIGATOR ? navigator.userAgent : null,
    platform: HAS_NAVIGATOR ? navigator.platform : null,
    language: HAS_NAVIGATOR ? navigator.language : null,
    online: HAS_NAVIGATOR ? navigator.onLine : true,
    url: IS_BROWSER ? window.location.href : null,
  };
}

/**
 * Builds a stable key for an error, used to de-duplicate repeated reports.
 */
export function fingerprint(
  error: unknown,
  context: Partial<ErrorContextData> = {},
): string {
  const stackTop =
    typeof context.componentStack === "string"
      ? context.componentStack.split("\n").find(Boolean) || ""
      : "";

  // Thrown values are untyped; read message/name defensively.
  const errObj = error as { message?: string; name?: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- error is unknown; a thrown non-Error object stringifies to "[object Object]" as before (behaviour kept in 3.5 restructure)
  const errorMessage = (errObj?.message || String(error || "")).slice(
    0,
    FINGERPRINT_MESSAGE_LENGTH,
  );
  const errorName = errObj?.name || DEFAULT_ERROR_NAME;
  const route = context.route || "";

  return [stackTop, errorMessage, errorName, route]
    .filter(Boolean)
    .join(FINGERPRINT_SEPARATOR);
}

/**
 * Normalizes any thrown value into an ErrorReport.
 */
export function createReport(
  error: unknown,
  { context = {}, tags = {} }: ReportOptions = {},
): ErrorReport {
  // Thrown values are untyped; read message/name/stack defensively.
  const errObj = error as {
    message?: string;
    name?: string;
    stack?: string;
  } | null;
  return {
    error: {
      message: errObj?.message || String(error),
      stack: errObj?.stack || null,
      name: errObj?.name || DEFAULT_ERROR_NAME,
    },
    fingerprint: fingerprint(error, context),
    timestamp: new Date().toISOString(),
    environment: getBrowserEnvironment(context.route as string | undefined),
    componentStack: (context.componentStack as string) || null,
    context,
    tags,
  };
}

/**
 * Extracts a trimmed message from any thrown value; empty when there is none.
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error.trim();
  if (error instanceof Error) return error.message.trim();

  const errObj = error as { message?: string; toString?: () => string };
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- error is unknown; the last fallback stringifies an object without message/toString to "[object Object]" as before (behaviour kept in 3.5 restructure)
  return String(errObj?.message || errObj?.toString?.() || error).trim();
}

/**
 * True for errors that should not be reported, such as not-found and network
 * noise.
 */
export function shouldIgnoreError(error: unknown): boolean {
  if (!error) return true;

  const errWithNotFound = error as { isNotFound?: () => boolean };
  if (
    typeof errWithNotFound?.isNotFound === "function" &&
    errWithNotFound.isNotFound()
  ) {
    return true;
  }

  const message = getErrorMessage(error);
  return ERROR_LISTENER_CONFIG.ignored.some((pattern) => pattern.test(message));
}
