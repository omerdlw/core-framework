import { defineThemeSpec } from "@/react/theme";

import {
  type LoadingActions,
  type LoadingState,
  type LoadingStateWithPage,
  type LoadingThemeSlot,
} from "./types";

/**
 * Loading state when nothing is loading.
 */
export const DEFAULT_LOADING_STATE: LoadingState = Object.freeze({
  isLoading: false,
  skeleton: null,
  minDuration: 0,
  showOverlay: true,
  message: null,
});

/**
 * Default loading state including the page flag.
 */
export const DEFAULT_LOADING_STATE_WITH_PAGE: LoadingStateWithPage =
  Object.freeze({
    ...DEFAULT_LOADING_STATE,
    isPageLoading: false,
  });

/**
 * Loading actions that do nothing; used outside a LoadingProvider.
 */
export const INERT_LOADING_ACTIONS: LoadingActions = Object.freeze({
  setLoading: () => {},
  setSkeleton: () => {},
  startLoading: () => {},
  stopLoading: () => {},
  withLoading: async <T>(task: Promise<T> | (() => Promise<T>)) =>
    typeof task === "function" ? task() : task,
});

/**
 * Registry key under which the page's loading setting is stored.
 */
export const LOADING_REGISTRY_KEY = "page-loading";
export const REGISTRY_CLEANUP_DELAY_MS = 600;
export const SPINNER_SIZE = 30;

/**
 * Theme spec for the loading overlay.
 */
export const loadingTheme = defineThemeSpec<LoadingThemeSlot>("loading");
