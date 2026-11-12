/**
 * Severity passed to the report sink.
 */
export type ReportLevel = "error" | "warn";

/**
 * Receives errors the framework reports instead of logging them itself.
 */
export type ReportSink = (
  scope: string,
  error: unknown,
  level: ReportLevel,
) => void;

const GLOBAL_SINK_KEY = Symbol.for("__base_framework_report_sink__");
type GlobalWithSink = typeof globalThis & {
  [GLOBAL_SINK_KEY]?: ReportSink | null;
};

const _global = globalThis as GlobalWithSink;

/**
 * Reports a non-fatal error to the installed sink, or to the console
 * outside production browsers.
 */
export function report(
  scope: string,
  error: unknown,
  level: ReportLevel = "error",
): void {
  const sink = _global[GLOBAL_SINK_KEY];
  if (sink) {
    try {
      sink(scope, error, level);
      return;
    } catch {}
  }

  if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
    return;
  }
  console[level](`[${scope}]`, error);
}

/**
 * Installs the global report sink and returns a function that removes it.
 */
export function setReportSink(next: ReportSink): () => void {
  _global[GLOBAL_SINK_KEY] = next;
  return () => {
    if (_global[GLOBAL_SINK_KEY] === next) _global[GLOBAL_SINK_KEY] = null;
  };
}
