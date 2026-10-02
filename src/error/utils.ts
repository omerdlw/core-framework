import type { ErrorInfo } from "react";
import { DEFAULT_DEDUPE_WINDOW, ERROR_LISTENER_CONFIG } from "./constants";
import type {
  BrowserEnvironment,
  ErrorContextData,
  ErrorReport,
} from "./types";

const IS_BROWSER = typeof window !== "undefined";
const HAS_NAVIGATOR = typeof navigator !== "undefined";

export const getRuntimePath = (): string | null =>
  typeof window !== "undefined" ? window.location.pathname : null;

export const getUserAgent = (): string | null =>
  typeof navigator !== "undefined" ? navigator.userAgent : null;

export function createErrorContext({
  errorInfo,
  name,
  title,
  variant,
}: {
  errorInfo?: ErrorInfo | null;
  name?: string;
  title?: string;
  variant?: string;
}): ErrorContextData {
  return {
    componentStack: errorInfo?.componentStack || null,
    route: getRuntimePath(),
    userAgent: getUserAgent(),
    timestamp: new Date().toISOString(),
    name: name || title || "ErrorBoundary",
    variant: variant || "default",
    source: "ErrorBoundary",
  };
}

export function normalizeSampleRate(value: unknown): number {
  const sampleRate = Number(value);
  return Number.isFinite(sampleRate) ? Math.min(1, Math.max(0, sampleRate)) : 1;
}

export function normalizeDedupeWindow(value: unknown): number {
  const dedupeWindow = Number(value);
  return Number.isFinite(dedupeWindow)
    ? Math.max(0, dedupeWindow)
    : DEFAULT_DEDUPE_WINDOW;
}

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

export function fingerprint(
  error: unknown,
  context: Partial<ErrorContextData> = {},
): string {
  const stackTop =
    typeof context.componentStack === "string"
      ? context.componentStack.split("\n").find(Boolean) || ""
      : "";

  const errObj = error as { message?: string; name?: string } | null;
  const errorMessage = (errObj?.message || String(error || "")).slice(0, 100);
  const errorName = errObj?.name || "UnknownError";
  const route = context.route || "";

  return [stackTop, errorMessage, errorName, route].filter(Boolean).join("::");
}

export function createReport(
  error: unknown,
  {
    context = {},
    tags = {},
  }: {
    context?: Record<string, unknown>;
    tags?: Record<string, string>;
  } = {},
): ErrorReport {
  const errObj = error as {
    message?: string;
    name?: string;
    stack?: string;
  } | null;
  return {
    error: {
      message: errObj?.message || String(error),
      stack: errObj?.stack || null,
      name: errObj?.name || "UnknownError",
    },
    fingerprint: fingerprint(error, context as Partial<ErrorContextData>),
    timestamp: new Date().toISOString(),
    environment: getBrowserEnvironment(context.route as string | undefined),
    componentStack: (context.componentStack as string) || null,
    context,
    tags,
  };
}

export function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error.trim();
  if (error instanceof Error) return error.message.trim();

  const errObj = error as { message?: string; toString?: () => string };
  return String(errObj?.message || errObj?.toString?.() || error).trim();
}

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
