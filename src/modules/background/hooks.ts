"use client";

import { useContext, useMemo } from "react";
import { useRequiredContext, useStore } from "@/hooks";
import {
  useModuleRegistration,
  type RegistryMetadata,
} from "@/kernel";
import { createStore } from "@/utils";
import { BackgroundContext } from "./context";
import {
  DEFAULT_BACKGROUND_COMPUTED,
  INERT_BACKGROUND_ACTIONS,
} from "./state";
import type {
  BackgroundActions,
  BackgroundPageConfig,
  BackgroundStateComputed,
} from "./types";

const NOOP_BACKGROUND_STORE = createStore<BackgroundStateComputed>(
  DEFAULT_BACKGROUND_COMPUTED,
);

export function useBackgroundRegistration(
  config: BackgroundPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("background", config, options);
}

export function useBackgroundState(): BackgroundStateComputed {
  const { store } = useRequiredContext(
    BackgroundContext,
    "useBackgroundState",
    "BackgroundProvider",
  );
  return useStore(store);
}

export function useBackgroundActions(): BackgroundActions {
  return useRequiredContext(
    BackgroundContext,
    "useBackgroundActions",
    "BackgroundProvider",
  ).actions;
}

export function useBackground(
  config?: BackgroundPageConfig | null,
  options?: RegistryMetadata & { enabled?: boolean },
): BackgroundStateComputed & BackgroundActions {
  useBackgroundRegistration(config, options);

  const actions = useBackgroundActions();
  const state = useBackgroundState();

  return useMemo(() => ({ ...state, ...actions }), [actions, state]);
}

export function useOptionalBackgroundState(): BackgroundStateComputed;
export function useOptionalBackgroundState<T>(
  selector: (state: BackgroundStateComputed) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useOptionalBackgroundState<T = BackgroundStateComputed>(
  selector?: (state: BackgroundStateComputed) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const ctx = useContext(BackgroundContext);
  return useStore(
    ctx?.store ?? NOOP_BACKGROUND_STORE,
    selector as (state: BackgroundStateComputed) => T,
    isEqual,
  );
}

export function useOptionalBackgroundActions(): BackgroundActions {
  const ctx = useContext(BackgroundContext);
  return ctx?.actions ?? INERT_BACKGROUND_ACTIONS;
}
