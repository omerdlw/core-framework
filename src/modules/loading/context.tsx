"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useIsomorphicLayoutEffect } from "@/hooks";
import {
  getOrCreateGlobalContext,
  useRegistryValue,
} from "@/kernel";
import { createStore } from "@/utils";
import {
  DEFAULT_LOADING_STATE,
  DEFAULT_LOADING_STATE_WITH_PAGE,
  LOADING_REGISTRY_KEY,
} from "./constants";
import {
  calculateRemainingMinDuration,
  normalizeLoadingOptions,
  resolveLoadingState,
} from "./state";
import {
  type LoadingActions,
  type LoadingContextValue,
  type LoadingOptions,
  type LoadingProviderProps,
  type LoadingState,
  type LoadingStateWithPage,
  type SkeletonValue,
} from "./types";

export const LoadingContext =
  getOrCreateGlobalContext<LoadingContextValue | null>("LoadingContext", null);

export const NOOP_LOADING_STORE = createStore<LoadingStateWithPage>(
  DEFAULT_LOADING_STATE_WITH_PAGE,
);

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
    const remaining = calculateRemainingMinDuration(
      startTimeRef.current,
      minDurationRef.current,
    );

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

  const state = useMemo<LoadingStateWithPage>(
    () => resolveLoadingState(manualState, registryLoading),
    [manualState, registryLoading],
  );

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
