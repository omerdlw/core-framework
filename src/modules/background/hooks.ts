"use client";

import { use, useMemo } from "react";

import { type RegistryMetadata, useModuleRegistration } from "@/core/kernel";
import { createStore } from "@/foundation/utils";
import { useRequiredContext, useStore } from "@/react/hooks";

import { BackgroundContext } from "./context";
import {
  DEFAULT_BACKGROUND_COMPUTED,
  INERT_BACKGROUND_ACTIONS,
} from "./model/state";
import type {
  BackgroundActions,
  BackgroundPageConfig,
  BackgroundStateComputed,
} from "./types";

const NOOP_BACKGROUND_STORE = createStore<BackgroundStateComputed>(
  DEFAULT_BACKGROUND_COMPUTED,
);

/**
 * Registers a background for the current page and removes it on unmount.
 */
export function useBackgroundRegistration(
  config: BackgroundPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("background", config, options);
}

/**
 * Reads the resolved background state. Must be used inside `BackgroundProvider`.
 */
export function useBackgroundState(): BackgroundStateComputed {
  const { store } = useRequiredContext(
    BackgroundContext,
    "useBackgroundState",
    "BackgroundProvider",
  );
  return useStore(store);
}

/**
 * Returns the stable background actions. Must be used inside `BackgroundProvider`.
 */
export function useBackgroundActions(): BackgroundActions {
  return useRequiredContext(
    BackgroundContext,
    "useBackgroundActions",
    "BackgroundProvider",
  ).actions;
}

/**
 * Registers an optional page background and returns the state merged with the actions.
 */
export function useBackground(
  config?: BackgroundPageConfig | null,
  options?: RegistryMetadata & { enabled?: boolean },
): BackgroundStateComputed & BackgroundActions {
  useBackgroundRegistration(config, options);

  const actions = useBackgroundActions();
  const state = useBackgroundState();

  return useMemo(() => ({ ...state, ...actions }), [actions, state]);
}

/**
 * Like `useBackgroundState`, but returns defaults outside a provider.
 * An optional selector narrows the subscription.
 */
export function useOptionalBackgroundState(): BackgroundStateComputed;
export function useOptionalBackgroundState<T>(
  selector: (state: BackgroundStateComputed) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useOptionalBackgroundState<T = BackgroundStateComputed>(
  selector?: (state: BackgroundStateComputed) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const ctx = use(BackgroundContext);
  return useStore(
    ctx?.store ?? NOOP_BACKGROUND_STORE,
    selector as (state: BackgroundStateComputed) => T,
    isEqual,
  );
}

/**
 * Like `useBackgroundActions`, but returns inert no-op actions outside a provider.
 */
export function useOptionalBackgroundActions(): BackgroundActions {
  const ctx = use(BackgroundContext);
  return ctx?.actions ?? INERT_BACKGROUND_ACTIONS;
}
