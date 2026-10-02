"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { globalEvents, type FrameworkEventMap } from "@/events";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";
import { UseGlobalEventOptions } from "./types";

export function useGlobalEvent<K extends keyof FrameworkEventMap>(
  event: K | K[] | null | undefined,
  callback: (payload: FrameworkEventMap[K]) => void,
  options?: UseGlobalEventOptions,
): void;

export function useGlobalEvent<T = unknown>(
  event: string | string[] | null | undefined,
  callback: (payload: T) => void,
  options?: UseGlobalEventOptions,
): void;

export function useGlobalEvent(
  event: string | string[] | null | undefined,
  callback: (payload: never) => void,
  options?: UseGlobalEventOptions,
): void {
  const callbackRef = useRef(callback);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThrottleTimeRef = useRef<number>(0);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useIsomorphicLayoutEffect(() => {
    callbackRef.current = callback;
  });

  const debounceMs = options?.debounceMs;
  const throttleMs = options?.throttleMs;

  useEffect(() => {
    if (!event) return;
    const events = Array.isArray(event) ? event.filter(Boolean) : [event];
    if (events.length === 0) return;

    const handler = (payload: never) => {
      if (debounceMs != null && debounceMs > 0) {
        if (debounceTimerRef.current !== null) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          callbackRef.current?.(payload);
        }, debounceMs);
        return;
      }

      if (throttleMs != null && throttleMs > 0) {
        const now = Date.now();
        const remaining = throttleMs - (now - lastThrottleTimeRef.current);
        if (remaining <= 0) {
          if (throttleTimerRef.current !== null) {
            clearTimeout(throttleTimerRef.current);
            throttleTimerRef.current = null;
          }
          lastThrottleTimeRef.current = now;
          callbackRef.current?.(payload);
        } else if (throttleTimerRef.current === null) {
          throttleTimerRef.current = setTimeout(() => {
            lastThrottleTimeRef.current = Date.now();
            throttleTimerRef.current = null;
            callbackRef.current?.(payload);
          }, remaining);
        }
        return;
      }

      callbackRef.current?.(payload);
    };

    const unsubs = events.map((ev) => globalEvents.subscribe(ev, handler));

    return () => {
      unsubs.forEach((unsub) => unsub());
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (throttleTimerRef.current !== null) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, [event, debounceMs, throttleMs]);
}

export function useEventState<T, K extends keyof FrameworkEventMap>(
  event: K | null | undefined,
  initialValue: T,
  reducer: (prevState: T, payload: FrameworkEventMap[K]) => T,
): T;

export function useEventState<T, P = unknown>(
  event: string | null | undefined,
  initialValue: T,
  reducer: (prevState: T, payload: P) => T,
): T;

export function useEventState<T, P = unknown>(
  event: string | null | undefined,
  initialValue: T,
  reducer: (prevState: T, payload: P) => T,
): T {
  const storeRef = useRef<{
    value: T;
    listeners: Set<() => void>;
    reducer: (prevState: T, payload: P) => T;
  } | null>(null);

  if (storeRef.current == null) {
    storeRef.current = {
      value: initialValue,
      listeners: new Set(),
      reducer,
    };
  }

  useIsomorphicLayoutEffect(() => {
    if (storeRef.current != null) {
      storeRef.current.reducer = reducer;
    }
  });

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!event || !storeRef.current) return () => {};
      storeRef.current.listeners.add(onStoreChange);

      const unsub = globalEvents.subscribe<P>(event, (payload) => {
        if (!storeRef.current) return;
        const next = storeRef.current.reducer(storeRef.current.value, payload);
        if (!Object.is(storeRef.current.value, next)) {
          storeRef.current.value = next;
          storeRef.current.listeners.forEach((listener) => listener());
        }
      });

      return () => {
        storeRef.current?.listeners.delete(onStoreChange);
        unsub();
      };
    },
    [event],
  );

  const getSnapshot = useCallback(() => {
    return storeRef.current?.value ?? initialValue;
  }, [initialValue]);

  const getServerSnapshot = useCallback(() => {
    return initialValue;
  }, [initialValue]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
