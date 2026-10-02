import {
  type LoadingOptions,
  type LoadingPageConfig,
  type LoadingState,
} from "./types";

export function normalizeLoadingOptions(
  options: LoadingOptions = {},
): Omit<LoadingState, "isLoading"> {
  const minDuration = Number(options.minDuration);
  return {
    message: typeof options.message === "string" ? options.message : null,
    minDuration:
      Number.isFinite(minDuration) && minDuration > 0 ? minDuration : 0,
    showOverlay: options.showOverlay !== false,
    skeleton: options.skeleton ?? null,
  };
}

export function selectPageLoading(
  loading: LoadingPageConfig | null | undefined,
): LoadingOptions | null {
  if (loading === undefined || loading === null) return null;
  if (typeof loading === "boolean") return { isLoading: loading };
  if (typeof loading === "string") return { isLoading: true, message: loading };
  return loading;
}
