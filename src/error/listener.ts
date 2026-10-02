"use client";

import { useCallback, useEffect, useRef } from "react";
import { EVENT_TYPES, globalEvents } from "@/events";
import { ERROR_LISTENER_CONFIG } from "./constants";
import { getErrorReporter } from "./reporter";
import { getErrorMessage, shouldIgnoreError } from "./utils";
import { report, setReportSink, toUserMessage } from "@/utils";

export function GlobalErrorListener(): null {
  const lastError = useRef<number>(0);
  const count = useRef<number>(0);
  const shown = useRef<Set<string>>(new Set());

  const handleError = useCallback((error: unknown, source = "runtime") => {
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

    try {
      const reporter = getErrorReporter();
      reporter?.captureError?.(error, {
        globalListener: true,
        source,
      });
    } catch (reportingError) {
      report("GlobalError reporting", reportingError, "warn");
    }

    globalEvents.emit(EVENT_TYPES.APP_ERROR, {
      error,
      message: toUserMessage(error),
    });
  }, []);

  useEffect(() => {
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
  }, [handleError]);

  return null;
}
