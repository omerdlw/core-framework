"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { getOrCreateGlobalContext, useRegistryValue } from "@/core/kernel";
import { createStore, shallowEqual } from "@/foundation/utils";

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

/**
 * React context holding the loading store and actions.
 */
export const LoadingContext =
  getOrCreateGlobalContext<LoadingContextValue | null>("LoadingContext", null);

const MANUAL_TASK = "manual";
type LoadingTaskKey = typeof MANUAL_TASK | number;

interface LoadingTask {
  key: LoadingTaskKey;
  state: Omit<LoadingState, "isLoading">;
}

/**
 * Store with the default state; used outside a LoadingProvider.
 */
export const NOOP_LOADING_STORE = createStore<LoadingStateWithPage>(
  DEFAULT_LOADING_STATE_WITH_PAGE,
);

interface LoadingTasks {
  beginTask: (key: LoadingTaskKey, options: LoadingOptions) => void;
  endTask: (key: LoadingTaskKey) => void;
  manualState: LoadingState;
  withLoading: LoadingActions["withLoading"];
  setSkeleton: (skeleton: SkeletonValue) => void;
}

/**
 * Keeps the stack of running loading tasks, the state they show, and the
 * minimum display time before loading may stop.
 */
/**
 * Awaits a task and always runs `settle` afterwards. Module level: the
 * compiler cannot lower a try without a catch inside a hook.
 */
async function runThenSettle<T>(
  task: Promise<T> | (() => Promise<T>),
  settle: () => void,
): Promise<T> {
  try {
    return typeof task === "function" ? await task() : await task;
  } finally {
    settle();
  }
}

function useLoadingTasks(): LoadingTasks {
  const [manualState, setManualState] = useState<LoadingState>(
    DEFAULT_LOADING_STATE,
  );

  const startTimeRef = useRef<number | null>(null);
  const minDurationRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tasksRef = useRef<LoadingTask[]>([]);
  const nextTaskRef = useRef(1);

  // stable identity: createLoadingActions captures it once (lazy useState)
  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current !== null) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  // stable identity: createLoadingActions captures it once (lazy useState)
  const resetState = useCallback(() => {
    clearStopTimer();
    minDurationRef.current = 0;
    startTimeRef.current = null;
    setManualState(DEFAULT_LOADING_STATE);
  }, [clearStopTimer]);

  // stable identity: createLoadingActions captures it once (lazy useState)
  const beginTask = useCallback(
    (key: LoadingTaskKey, options: LoadingOptions) => {
      clearStopTimer();
      const nextState = normalizeLoadingOptions(options);
      const tasks = tasksRef.current.filter((task) => task.key !== key);
      tasks.push({ key, state: nextState });
      tasksRef.current = tasks;
      if (startTimeRef.current === null) startTimeRef.current = Date.now();
      minDurationRef.current = Math.max(
        minDurationRef.current,
        nextState.minDuration,
      );
      setManualState({ ...nextState, isLoading: true });
    },
    [clearStopTimer],
  );

  // stable identity: createLoadingActions captures it once (lazy useState)
  const endTask = useCallback(
    (key: LoadingTaskKey) => {
      const tasks = tasksRef.current;
      if (!tasks.some((task) => task.key === key)) return;
      tasksRef.current = tasks.filter((task) => task.key !== key);
      const latest = tasksRef.current.at(-1);
      if (latest) {
        setManualState({ ...latest.state, isLoading: true });
        return;
      }

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
    },
    [clearStopTimer, resetState],
  );

  // stable identity: createLoadingActions captures it once (lazy useState)
  const setSkeleton = useCallback((nextSkeleton: SkeletonValue) => {
    setManualState((currentState) => {
      const skeleton =
        typeof nextSkeleton === "function"
          ? nextSkeleton(currentState.skeleton)
          : nextSkeleton;

      const latest = tasksRef.current.at(-1);
      if (latest) latest.state = { ...latest.state, skeleton };
      return currentState.skeleton === skeleton
        ? currentState
        : { ...currentState, skeleton };
    });
  }, []);

  // stable identity: createLoadingActions captures it once (lazy useState)
  const withLoading = useCallback(
    async <T,>(
      task: Promise<T> | (() => Promise<T>),
      options: LoadingOptions | string = {},
    ): Promise<T> => {
      const key = nextTaskRef.current++;
      beginTask(
        key,
        typeof options === "string" ? { message: options } : options,
      );
      return runThenSettle(task, () => endTask(key));
    },
    [beginTask, endTask],
  );

  useEffect(() => clearStopTimer, [clearStopTimer]);

  return { beginTask, endTask, manualState, setSkeleton, withLoading };
}

/**
 * Builds the loading actions on top of the task stack. The task functions are
 * stable, so the actions are built once.
 */
function createLoadingActions({
  beginTask,
  endTask,
  setSkeleton,
  withLoading,
}: Omit<LoadingTasks, "manualState">): LoadingActions {
  const startLoading = (options: LoadingOptions = {}) =>
    beginTask(MANUAL_TASK, options);
  const stopLoading = () => endTask(MANUAL_TASK);
  return {
    setLoading: (value: boolean) => {
      if (value) startLoading();
      else stopLoading();
    },
    setSkeleton,
    startLoading,
    stopLoading,
    withLoading,
  };
}

/**
 * Provides loading state and actions to its children. Page-level loading from
 * the registry takes precedence over manual loading.
 */
export function LoadingProvider({ children }: LoadingProviderProps) {
  const tasks = useLoadingTasks();
  const { manualState } = tasks;

  const registryLoading = useRegistryValue<"loading", LoadingOptions>(
    "loading",
    LOADING_REGISTRY_KEY,
  );

  const [value] = useState<LoadingContextValue>(() => ({
    actions: createLoadingActions(tasks),
    store: createStore<LoadingStateWithPage>(
      resolveLoadingState(manualState, registryLoading),
      { freezeSnapshots: false },
    ),
  }));
  const { store } = value;
  useLayoutEffect(() => {
    const next = resolveLoadingState(manualState, registryLoading);
    store.publish((current) => (shallowEqual(current, next) ? current : next));
  }, [manualState, registryLoading, store]);

  return <LoadingContext value={value}>{children}</LoadingContext>;
}
