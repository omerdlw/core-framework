import type { ErrorInfo, ReactNode } from "react";

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

export interface BrowserEnvironment {
  [key: string]: unknown;
  language: string | null;
  online: boolean;
  platform: string | null;
  route: string | null;
  url: string | null;
  userAgent: string | null;
}

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

export interface ErrorReporterHandler {
  name: string;
  handle: (report: ErrorReport) => void;
}

export interface ErrorReporterOptions {
  beforeSend?: ((report: ErrorReport) => ErrorReport | null) | null;
  deduplicateWindow?: number;
  enabled?: boolean;
  sampleRate?: number;
}

export type ErrorFallbackRender = (props: {
  error: Error | null;
  resetError: () => void;
}) => ReactNode;

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

export interface ErrorBoundaryCoreState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  hasError: boolean;
  lastResetKey?: unknown;
}

export interface GlobalErrorProps {
  children?: ReactNode;
  fallback?: ReactNode | ErrorFallbackRender;
  onReset?: () => void;
}

export interface ModuleErrorProps {
  children?: ReactNode;
  fallback?: ReactNode | ErrorFallbackRender;
  name?: string;
  onReset?: () => void;
}

export interface ComponentErrorProps {
  children?: ReactNode;
  fallback?: ReactNode | ErrorFallbackRender;
  message?: string;
  onReset?: () => void;
}

export interface SentryScope {
  setContext: (name: string, context: Record<string, unknown>) => void;
  setExtra: (key: string, extra: unknown) => void;
  setFingerprint: (fingerprint: string[]) => void;
  setTag: (key: string, value: string) => void;
  setUser: (user: unknown) => void;
}
