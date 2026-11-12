"use client";

import { use, useMemo } from "react";
import {
  useIsFullscreenStateActive,
  useRequiredContext,
  useStore,
} from "@/react/hooks";
import { useModuleRegistration, type RegistryMetadata } from "@/core/kernel";
import { useTheme } from "@/react/theme";
import { INERT_LOADING_ACTIONS, loadingTheme } from "./constants";
import { LoadingContext, NOOP_LOADING_STORE } from "./context";
import {
  type LoadingActions,
  type LoadingPageConfig,
  type LoadingStateWithPage,
  type LoadingTheme,
} from "./types";

export function useLoadingRegistration(
  config: LoadingPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("loading", config, options);
}

export function useLoadingState(): LoadingStateWithPage {
  const { store } = useRequiredContext(
    LoadingContext,
    "useLoadingState",
    "LoadingProvider",
  );
  return useStore(store);
}

export function useLoadingActions(): LoadingActions {
  return useRequiredContext(
    LoadingContext,
    "useLoadingActions",
    "LoadingProvider",
  ).actions;
}

export function useLoading(
  config?: LoadingPageConfig | null,
  options?: RegistryMetadata & { enabled?: boolean },
): LoadingStateWithPage & LoadingActions {
  useLoadingRegistration(config, options);

  const actions = useLoadingActions();
  const state = useLoadingState();

  return useMemo(() => ({ ...state, ...actions }), [actions, state]);
}

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

export function useOptionalLoadingActions(): LoadingActions {
  const ctx = use(LoadingContext);
  return ctx?.actions ?? INERT_LOADING_ACTIONS;
}

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
