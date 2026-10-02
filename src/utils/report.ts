export type ReportLevel = "error" | "warn";

export type ReportSink = (
  scope: string,
  error: unknown,
  level: ReportLevel,
) => void;

let sink: ReportSink | null = null;

export function report(
  scope: string,
  error: unknown,
  level: ReportLevel = "error",
): void {
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

export function setReportSink(next: ReportSink): () => void {
  sink = next;
  return () => {
    if (sink === next) sink = null;
  };
}
