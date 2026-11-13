"use client";

import { useEffect, useRef } from "react";

import { EVENT_TYPES, globalEvents } from "@/foundation/events";
import { report, setReportSink, toUserMessage } from "@/foundation/utils";

import { ERROR_LISTENER_CONFIG } from "./constants";
import { getErrorReporter } from "./reporter";
import { getErrorMessage, shouldIgnoreError } from "./utils";

/**
 * Sends an error to the configured reporter. Its own failures are reported
 * as warnings. Module level so the try/catch stays out of the component (the
 * compiler cannot lower optional chaining inside a try block).
 */
function captureGlobalError(error: unknown, source: string) {
  try {
    const reporter = getErrorReporter();
    reporter?.captureError?.(error, { globalListener: true, source });
  } catch (reportingError) {
    report("GlobalError reporting", reportingError, "warn");
  }
}

/**
 * Listens for uncaught window errors and unhandled rejections, then reports
 * them and emits an app error event (throttled and de-duplicated).
 */
export function GlobalErrorListener(): null {
  const lastError = useRef<number>(0);
  const count = useRef<number>(0);
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleError = (error: unknown, source = "runtime") => {
      if (shouldIgnoreError(error)) return;

      const now = Date.now();

      if (count.current >= ERROR_LISTENER_CONFIG.maxErrors) return;
      if (now - lastError.current < ERROR_LISTENER_CONFIG.throttle) return;

      const message = getErrorMessage(error);
      const key = message || String(error);

      if (shown.current.has(key)) return;
      shown.current.add(key);

      lastError.current = now;
      count.current += 1;

      captureGlobalError(error, source);

      globalEvents.emit(EVENT_TYPES.APP_ERROR, {
        error,
        message: toUserMessage(error),
      });
    };

    const removeSink = setReportSink((scope, error, level) => {
      try {
        getErrorReporter().captureError(error, { level, scope });
      } catch {}
    });
    const onError = (event: ErrorEvent) =>
      handleError(event.error || event.message, "window.onerror");
    const onRejection = (event: PromiseRejectionEvent) =>
      handleError(event.reason, "unhandledrejection");

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      removeSink();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
