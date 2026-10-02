import { defineThemeSpec } from "@/theme";
import {
  type LoadingActions,
  type LoadingState,
  type LoadingStateWithPage,
  type LoadingThemeSlot,
} from "./types";

export const DEFAULT_LOADING_STATE: LoadingState = Object.freeze({
  isLoading: false,
  skeleton: null,
  minDuration: 0,
  showOverlay: true,
  message: null,
});

export const DEFAULT_LOADING_STATE_WITH_PAGE: LoadingStateWithPage = Object.freeze({
  ...DEFAULT_LOADING_STATE,
  isPageLoading: false,
});

export const INERT_LOADING_ACTIONS: LoadingActions = Object.freeze({
  setLoading: () => {},
  setSkeleton: () => {},
  startLoading: () => {},
  stopLoading: () => {},
  withLoading: async <T,>(task: Promise<T> | (() => Promise<T>)) =>
    typeof task === "function" ? task() : task,
});

export const LOADING_REGISTRY_KEY = "page-loading";

export const loadingTheme = defineThemeSpec<LoadingThemeSlot>("loading");
