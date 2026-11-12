"use client";

import { use, useMemo } from "react";

import { type RegistryMetadata, useModuleRegistration } from "@/core/kernel";
import {
  useIsFullscreenStateActive,
  useRequiredContext,
  useStore,
} from "@/react/hooks";
import { useTheme } from "@/react/theme";

import { INERT_LOADING_ACTIONS, loadingTheme } from "./constants";
import { LoadingContext, NOOP_LOADING_STORE } from "./context";
import {
  type LoadingActions,
  type LoadingPageConfig,
  type LoadingStateWithPage,
  type LoadingTheme,
} from "./types";

/**
 * Registers a loading setting for the current page.
 */
export function useLoadingRegistration(
  config: LoadingPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("loading", config, options);
}

/**
 * Subscribes to the loading state.
 */
export function useLoadingState(): LoadingStateWithPage {
  const { store } = useRequiredContext(
    LoadingContext,
    "useLoadingState",
    "LoadingProvider",
  );
  return useStore(store);
}

/**
 * Returns the loading actions without subscribing to state changes.
 */
export function useLoadingActions(): LoadingActions {
  return useRequiredContext(
    LoadingContext,
    "useLoadingActions",
    "LoadingProvider",
  ).actions;
}

/**
 * Registers an optional page loading setting and returns the state with the
 * actions.
 */
export function useLoading(
  config?: LoadingPageConfig | null,
  options?: RegistryMetadata & { enabled?: boolean },
): LoadingStateWithPage & LoadingActions {
  useLoadingRegistration(config, options);

  const actions = useLoadingActions();
  const state = useLoadingState();

  // stable identity: part of the public hook contract
  return useMemo(() => ({ ...state, ...actions }), [actions, state]);
}

/**
 * Like useLoadingState, but returns the default state outside a
 * LoadingProvider. Accepts a selector.
 */
export function useOptionalLoadingState(): LoadingStateWithPage;
export function useOptionalLoadingState<T>(
  selector: (state: LoadingStateWithPage) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useOptionalLoadingState<T = LoadingStateWithPage>(
  selector?: (state: LoadingStateWithPage) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const ctx = use(LoadingContext);
  return useStore(
    ctx?.store ?? NOOP_LOADING_STORE,
    selector as (state: LoadingStateWithPage) => T,
    isEqual,
  );
}

/**
 * Like useLoadingActions, but returns inert actions outside a LoadingProvider.
 */
export function useOptionalLoadingActions(): LoadingActions {
  const ctx = use(LoadingContext);
  return ctx?.actions ?? INERT_LOADING_ACTIONS;
}

/**
 * Skeleton, visibility and theme for LoadingOverlay.
 */
export function useLoadingOverlayModel(): {
  skeleton: React.ReactNode | null;
  isVisible: boolean;
  theme: LoadingTheme;
} {
  const { isLoading, skeleton, showOverlay } = useLoadingState();
  const isFullscreenStateActive = useIsFullscreenStateActive();
  const isVisible = isLoading && showOverlay && !isFullscreenStateActive;

  const theme = useTheme(loadingTheme);

  return { skeleton, isVisible, theme };
}
