export const ERROR_MESSAGES = Object.freeze({
  GLOBAL_TITLE: "Something went wrong",
  GLOBAL_MSG: "We ran into an unexpected problem. Please try again",
  MODULE_TITLE: "Something went wrong",
  MODULE_MSG: "This part of the app isn't working right now. Please try again",
  COMPONENT_MSG: "This section couldn't be loaded. Please try again",
  FALLBACK_TITLE: "Something went wrong",
  FALLBACK_MSG: "This section couldn't be loaded. Please try again",
} as const);

export const MAX_CONTEXT = 10;
export const MAX_FINGERPRINTS = 100;
export const DEFAULT_DEDUPE_WINDOW = 60000;

export const ERROR_LISTENER_CONFIG = Object.freeze({
  maxErrors: 10,
  throttle: 2000,
  ignored: Object.freeze([
    /ResizeObserver loop/i,
    /Network request failed/i,
    /Loading chunk/i,
    /Unexpected end of input/i,
    /Failed to fetch/i,
    /Script error/i,
    /HTTP\s*404/i,
  ]),
} as const);
