import {
  DEFAULT_DEDUPE_WINDOW,
  MAX_CONTEXT,
  MAX_FINGERPRINTS,
} from "./constants";
import type {
  ErrorReport,
  ErrorReporterHandler,
  ErrorReporterOptions,
  SentryScope,
} from "./types";
import {
  createReport,
  normalizeDedupeWindow,
  normalizeSampleRate,
} from "./utils";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_BROWSER = typeof window !== "undefined";

declare global {
  interface Window {
    Sentry?: {
      captureException: (error: unknown) => void;
      withScope: (callback: (scope: SentryScope) => void) => void;
    };
  }
}

class ErrorReporter {
  private handlers: ErrorReporterHandler[] = [];
  private context: Record<string, unknown> = {};
  private tags: Record<string, string> = {};
  private seen = new Set<string>();
  private enabled: boolean;
  private sampleRate: number;
  private beforeSend: ((report: ErrorReport) => ErrorReport | null) | null;
  private dedupeWindow: number;

  constructor(options: ErrorReporterOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.sampleRate = normalizeSampleRate(options.sampleRate ?? 1);
    this.beforeSend = options.beforeSend || null;
    this.dedupeWindow = normalizeDedupeWindow(
      options.deduplicateWindow ?? DEFAULT_DEDUPE_WINDOW,
    );
  }

  addHandler(handler: ErrorReporterHandler): this {
    if (typeof handler?.handle === "function") {
      this.handlers.push(handler);
    }
    return this;
  }

  removeHandler(name: string): this {
    this.handlers = this.handlers.filter((handler) => handler.name !== name);
    return this;
  }

  setContext(key: string, value: unknown): this {
    if (
      Object.hasOwn(this.context, key) ||
      Object.keys(this.context).length < MAX_CONTEXT
    ) {
      this.context[key] = value;
    }
    return this;
  }

  setTag(key: string, value: unknown): this {
    this.tags[key] = String(value);
    return this;
  }

  captureError(
    error: unknown,
    extraContext: Record<string, unknown> = {},
  ): ErrorReport | undefined {
    if (!this.enabled || Math.random() > this.sampleRate) return;

    this.ensureDefaultHandlers();

    const context = { ...this.context, ...extraContext };
    const report = createReport(error, { context, tags: { ...this.tags } });

    if (!this.remember(report.fingerprint)) return;

    const outgoing = this.transform(report);
    if (!outgoing) return;

    this.dispatch(outgoing);

    return outgoing;
  }

  /** Records a fingerprint for the dedupe window; false when already seen. */
  private remember(dedupeKey: string): boolean {
    if (this.seen.has(dedupeKey)) return false;

    if (this.seen.size >= MAX_FINGERPRINTS) {
      const first = this.seen.keys().next().value;
      if (first) this.seen.delete(first);
    }

    this.seen.add(dedupeKey);
    setTimeout(() => this.seen.delete(dedupeKey), this.dedupeWindow);

    return true;
  }

  /** Runs beforeSend; a throwing hook leaves the report unchanged. */
  private transform(report: ErrorReport): ErrorReport | null {
    if (typeof this.beforeSend !== "function") return report;

    try {
      return this.beforeSend(report);
    } catch {
      return report;
    }
  }

  private dispatch(report: ErrorReport): void {
    this.handlers.forEach((handler) => {
      try {
        handler.handle(report);
      } catch {}
    });
  }

  captureMessage(
    message: string,
    level = "info",
    context: Record<string, unknown> = {},
  ): ErrorReport | undefined {
    const error = new Error(message);
    error.name = "Message";
    return this.captureError(error, { ...context, level });
  }

  ensureDefaultHandlers(): void {
    if (this.handlers.length || !IS_BROWSER) return;

    this.handlers.push(createConsoleHandler());

    if (window.Sentry) {
      const sentryHandler = createSentryHandler(window.Sentry);
      if (sentryHandler.name === "sentry") {
        this.handlers.push(sentryHandler);
      }
    }
  }
}

const GLOBAL_REPORTER_KEY = Symbol.for("__base_framework_error_reporter__");
type GlobalWithReporter = typeof globalThis & {
  [GLOBAL_REPORTER_KEY]?: ErrorReporter;
};

const _global = globalThis as GlobalWithReporter;

/**
 * Returns the shared error reporter, creating it with the given options on
 * first use.
 */
export function getErrorReporter(
  options: ErrorReporterOptions = {},
): ErrorReporter {
  return (_global[GLOBAL_REPORTER_KEY] ??= new ErrorReporter(options));
}

/**
 * Creates a reporter handler that logs errors to the console outside
 * production.
 */
export function createConsoleHandler(): ErrorReporterHandler {
  return {
    name: "console",
    handle(report: ErrorReport) {
      if (IS_PRODUCTION) return;
      console.error("[ErrorReporter]", {
        error: report.error.message,
        fingerprint: report.fingerprint,
        route: report.environment.route,
      });
    },
  };
}

interface SentryApi {
  captureException: (err: Error) => void;
  withScope: (cb: (scope: SentryScope) => void) => void;
}

function isSentryApi(value: unknown): value is SentryApi {
  const candidate = value as Partial<SentryApi> | null;
  return (
    !!candidate &&
    typeof candidate.captureException === "function" &&
    typeof candidate.withScope === "function"
  );
}

function applyReportToScope(scope: SentryScope, report: ErrorReport): void {
  if (report.fingerprint) scope.setFingerprint([report.fingerprint]);
  if (report.user) scope.setUser(report.user);

  if (report.tags && typeof report.tags === "object") {
    Object.entries(report.tags).forEach(([key, value]) =>
      scope.setTag(key, String(value)),
    );
  }

  if (report.environment) scope.setContext("environment", report.environment);
  if (report.context) scope.setContext("custom", report.context);
  if (report.componentStack)
    scope.setExtra("componentStack", report.componentStack);
}

function toSentryError(report: ErrorReport): Error {
  const error = new Error(report.error.message);
  error.name = report.error.name || "Error";
  error.stack = report.error.stack || undefined;
  return error;
}

/**
 * Creates a reporter handler that forwards errors to Sentry, falling back to
 * the console handler when Sentry is unusable.
 */
export function createSentryHandler(Sentry: unknown): ErrorReporterHandler {
  // The argument is untyped on purpose (window.Sentry or a user-supplied
  // client); isSentryApi narrows it before use.
  if (!isSentryApi(Sentry)) return createConsoleHandler();

  return {
    name: "sentry",
    handle(report: ErrorReport) {
      Sentry.withScope((scope: SentryScope) => {
        applyReportToScope(scope, report);
        Sentry.captureException(toSentryError(report));
      });
    },
  };
}
