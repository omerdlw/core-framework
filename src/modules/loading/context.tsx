"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useIsomorphicLayoutEffect,
  useRequiredContext,
  useStore,
} from "@/hooks";
import {
  getOrCreateGlobalContext,
  useModuleRegistration,
  useRegistryValue,
  type RegistryMetadata,
} from "@/kernel";

import { createStore } from "@/utils";
import {
  DEFAULT_LOADING_STATE,
  DEFAULT_LOADING_STATE_WITH_PAGE,
  INERT_LOADING_ACTIONS,
  LOADING_REGISTRY_KEY,
} from "./constants";
import {
  type LoadingActions,
  type LoadingContextValue,
  type LoadingOptions,
  type LoadingPageConfig,
  type LoadingProviderProps,
  type LoadingState,
  type LoadingStateWithPage,
  type SkeletonValue,
} from "./types";
import { normalizeLoadingOptions } from "./utils";

export const LoadingContext =

  getOrCreateGlobalContext<LoadingContextValue | null>("LoadingContext", null);

export function useLoadingRegistration(
  config: LoadingPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("loading", config, options);
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [manualState, setManualState] = useState<LoadingState>(
    DEFAULT_LOADING_STATE,
  );

  const startTimeRef = useRef<number | null>(null);
  const minDurationRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registryLoading = useRegistryValue<"loading", LoadingOptions>(
    "loading",
    LOADING_REGISTRY_KEY,
  );

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current !== null) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    clearStopTimer();
    minDurationRef.current = 0;
    startTimeRef.current = null;
    setManualState(DEFAULT_LOADING_STATE);
  }, [clearStopTimer]);

  const startLoading = useCallback(
    (options: LoadingOptions = {}) => {
      clearStopTimer();
      const nextState = normalizeLoadingOptions(options);
      startTimeRef.current = Date.now();
      minDurationRef.current = nextState.minDuration;
      setManualState({
        ...nextState,
        isLoading: true,
      });
    },
    [clearStopTimer],
  );

  const stopLoading = useCallback(() => {
    const startTime = startTimeRef.current;
    const activeMinDuration = minDurationRef.current;

    if (startTime === null || activeMinDuration === 0) {
      resetState();
      return;
    }

    const elapsed = Date.now() - startTime;
    const remaining = activeMinDuration - elapsed;

    if (remaining <= 0) {
      resetState();
      return;
    }

    clearStopTimer();
    stopTimerRef.current = setTimeout(resetState, remaining);
  }, [clearStopTimer, resetState]);

  const setLoading = useCallback(
    (value: boolean) => {
      if (value) startLoading();
      else stopLoading();
    },
    [startLoading, stopLoading],
  );

  const setSkeleton = useCallback((nextSkeleton: SkeletonValue) => {
    setManualState((currentState) => {
      const skeleton =
        typeof nextSkeleton === "function"
          ? nextSkeleton(currentState.skeleton)
          : nextSkeleton;

      return currentState.skeleton === skeleton
        ? currentState
        : { ...currentState, skeleton };
    });
  }, []);

  const withLoading = useCallback(
    async <T,>(
      task: Promise<T> | (() => Promise<T>),
      options: LoadingOptions | string = {},
    ): Promise<T> => {
      startLoading(
        typeof options === "string" ? { message: options } : options,
      );
      try {
        return typeof task === "function" ? await task() : await task;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading],
  );

  useEffect(() => clearStopTimer, [clearStopTimer]);

  const state = useMemo<LoadingStateWithPage>(() => {
    if (registryLoading?.isLoading) {
      const normalized = normalizeLoadingOptions(registryLoading);
      return {
        ...normalized,
        isLoading: true,
        isPageLoading: true,
      };
    }
    return {
      ...manualState,
      isPageLoading: manualState.isLoading,
    };
  }, [manualState, registryLoading]);

  const actions = useMemo<LoadingActions>(
    () => ({
      setLoading,
      setSkeleton,
      startLoading,
      stopLoading,
      withLoading,
    }),
    [setLoading, setSkeleton, startLoading, stopLoading, withLoading],
  );

  const [store] = useState(() =>
    createStore<LoadingStateWithPage>(state, { freezeSnapshots: false }),
  );
  useIsomorphicLayoutEffect(() => {
    store.publish(state);
  }, [state, store]);

  const value = useMemo<LoadingContextValue>(
    () => ({ actions, store }),
    [actions, store],
  );

  return <LoadingContext value={value}>{children}</LoadingContext>;
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

const NOOP_LOADING_STORE = createStore<LoadingStateWithPage>(
  DEFAULT_LOADING_STATE_WITH_PAGE,
);

export function useOptionalLoadingState(): LoadingStateWithPage;
export function useOptionalLoadingState<T>(
  selector: (state: LoadingStateWithPage) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useOptionalLoadingState<T = LoadingStateWithPage>(
  selector?: (state: LoadingStateWithPage) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const ctx = useContext(LoadingContext);
  return useStore(
    ctx?.store ?? NOOP_LOADING_STORE,
    selector as (state: LoadingStateWithPage) => T,
    isEqual,
  );
}

export function useOptionalLoadingActions(): LoadingActions {
  const ctx = useContext(LoadingContext);
  return ctx?.actions ?? INERT_LOADING_ACTIONS;
}

