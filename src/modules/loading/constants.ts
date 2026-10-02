import { defineThemeSpec } from "../theme";
import { type LoadingState, type LoadingThemeSlot } from "./types";

export const DEFAULT_LOADING_STATE: LoadingState = Object.freeze({
  isLoading: false,
  skeleton: null,
  minDuration: 0,
  showOverlay: true,
  message: null,
});

export const LOADING_REGISTRY_KEY = "page-loading";

export const loadingTheme = defineThemeSpec<LoadingThemeSlot>("loading");
