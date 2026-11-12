"use client";

export {
  DEFAULT_DEDUPE_WINDOW,
  ERROR_LISTENER_CONFIG,
  ERROR_MESSAGES,
  MAX_CONTEXT,
  MAX_FINGERPRINTS,
} from "./constants";

export {
  createErrorContext,
  createReport,
  fingerprint,
  getBrowserEnvironment,
  getErrorMessage,
  getRuntimePath,
  getUserAgent,
  normalizeDedupeWindow,
  normalizeSampleRate,
  shouldIgnoreError,
} from "./utils";

export {
  createConsoleHandler,
  createSentryHandler,
  getErrorReporter,
} from "./reporter";

export {
  ComponentError,
  ErrorBoundaryCore,
  GlobalError,
  ModuleError,
} from "./boundary";

export { GlobalErrorListener } from "./listener";

export { errorTheme } from "./theme";
export type { ErrorThemeSlot } from "./theme";

export type * from "./types";
