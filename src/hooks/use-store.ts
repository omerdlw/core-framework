"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { type ExternalStore } from "../utils";

export function useStore<TState, TSlice = TState>(
  store: ExternalStore<TState>,
  selector: (state: TState) => TSlice = (state: TState) =>
    state as unknown as TSlice,
  isEqual: (a: TSlice, b: TSlice) => boolean = Object.is,
): TSlice {
  const cacheRef = useRef<{
    isEqual: ((a: TSlice, b: TSlice) => boolean) | null;
    selected: TSlice | undefined;
    selector: ((state: TState) => TSlice) | null;
    snapshot: TState | null;
  }>({
    isEqual: null,
    selected: undefined,
    selector: null,
    snapshot: null,
  });

  const getSelectedSnapshot = useCallback(() => {
    const snapshot = store.getSnapshot();
    const cache = cacheRef.current;
    if (
      cache.snapshot === snapshot &&
      cache.selector === selector &&
      cache.isEqual === isEqual
    ) {
      return cache.selected as TSlice;
    }

    const selected = selector(snapshot);
    if (
      cache.snapshot !== null &&
      cache.isEqual === isEqual &&
      isEqual(cache.selected as TSlice, selected)
    ) {
      cache.snapshot = snapshot;
      cache.selector = selector;
      return cache.selected as TSlice;
    }

    cacheRef.current = {
      isEqual,
      selected,
      selector,
      snapshot,
    };
    return selected;
  }, [isEqual, selector, store]);

  return useSyncExternalStore(
    store.subscribe,
    getSelectedSnapshot,
    getSelectedSnapshot,
  );
}
