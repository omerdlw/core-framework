import type { ErrorInfo, ReactNode } from "react";

/**
 * Metadata describing where and when an error boundary caught an error.
 */
export interface ErrorContextData {
  [key: string]: unknown;
  componentStack: string | null;
  name: string;
  route: string | null;
  source: string;
  timestamp: string;
  userAgent: string | null;
  variant: string;
}

/**
 * Snapshot of the browser environment attached to an error report.
 */
export interface BrowserEnvironment {
  [key: string]: unknown;
  language: string | null;
  online: boolean;
  platform: string | null;
  route: string | null;
  url: string | null;
  userAgent: string | null;
}

/**
 * A normalized error report passed to error reporter handlers.
 */
export interface ErrorReport {
  componentStack: string | null;
  context: Record<string, unknown>;
  environment: BrowserEnvironment;
  error: {
    message: string;
    name: string;
    stack: string | null;
  };
  fingerprint: string;
  tags: Record<string, string>;
  timestamp: string;
  user?: unknown;
}

/**
 * A named sink that receives error reports, such as the console or Sentry.
 */
export interface ErrorReporterHandler {
  name: string;
  handle: (report: ErrorReport) => void;
}

/**
 * Options for the error reporter: sampling, de-duplication and a pre-send hook.
 */
export interface ErrorReporterOptions {
  beforeSend?: ((report: ErrorReport) => ErrorReport | null) | null;
  deduplicateWindow?: number;
  enabled?: boolean;
  sampleRate?: number;
}

/**
 * Render function for a custom error fallback; receives the error and a reset
 * callback.
 */
export type ErrorFallbackRender = (props: {
  error: Error | null;
  resetError: () => void;
}) => ReactNode;

/**
 * Props for ErrorBoundaryCore, the base error boundary.
 */
export interface ErrorBoundaryCoreProps {
  children?: ReactNode;
  fallback?: ReactNode | ErrorFallbackRender;
  message?: string;
  name?: string;
  onError?: (
    error: Error,
    errorInfo: ErrorInfo,
    context: ErrorContextData,
  ) => void;
  onReset?: () => void;
  resetKey?: unknown;
  silent?: boolean;
  title?: string;
  variant?: "default" | "full" | "module" | "inline" | string;
}

/**
 * Internal state of ErrorBoundaryCore.
 */
export interface ErrorBoundaryCoreState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  hasError: boolean;
  lastResetKey?: unknown;
}

/**
 * Props for GlobalError.
 */
export interface GlobalErrorProps {
  children?: ReactNode;
  fallback?: ReactNode | ErrorFallbackRender;
  onReset?: () => void;
}

/**
 * Props for ModuleError.
 */
export interface ModuleErrorProps {
  children?: ReactNode;
  fallback?: ReactNode | ErrorFallbackRender;
  name?: string;
  onReset?: () => void;
}

/**
 * Props for ComponentError.
 */
export interface ComponentErrorProps {
  children?: ReactNode;
  fallback?: ReactNode | ErrorFallbackRender;
  message?: string;
  onReset?: () => void;
}

/**
 * The subset of the Sentry scope API the Sentry handler uses.
 */
export interface SentryScope {
  setContext: (name: string, context: Record<string, unknown>) => void;
  setExtra: (key: string, extra: unknown) => void;
  setFingerprint: (fingerprint: string[]) => void;
  setTag: (key: string, value: string) => void;
  setUser: (user: unknown) => void;
}
