"use client";

import { useRef, useSyncExternalStore } from "react";

import { type ExternalStore } from "@/foundation/utils";

/**
 * Subscribes a component to an external store, optionally to a selected slice with a custom equality check.
 */
// Module level so the default keeps one identity (and the compiler can lower
// the parameter list).
const selectWholeState = <T>(state: T) => state;

export function useStore<TState, TSlice = TState>(
  store: ExternalStore<TState>,
  // The default selector returns the whole state, so TSlice is TState.
  selector: (state: TState) => TSlice = selectWholeState as unknown as (
    state: TState,
  ) => TSlice,
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

  // A new getter per render is fine: the cache above keeps the snapshot
  // stable, and only subscribe's identity makes React resubscribe.
  const getSelectedSnapshot = () => {
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
  };

  return useSyncExternalStore(
    store.subscribe,
    getSelectedSnapshot,
    getSelectedSnapshot,
  );
}
