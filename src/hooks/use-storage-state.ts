"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { isBrowser } from "../utils";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";
import { UseStorageStateOptions } from "./types";

function getStorageInstance(type: "local" | "session"): Storage | null {
  if (!isBrowser) return null;
  try {
    return type === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

const STORAGE_SYNC_EVENT = "base-framework:storage-sync";

export function useStorageState<T>(
  key: string,
  initialValue: T,
  options: UseStorageStateOptions<T> = {},
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const storageType = options.storage ?? "local";
  const serialize = options.serialize ?? JSON.stringify;
  const deserialize = options.deserialize ?? JSON.parse;

  const cacheRef = useRef<{ parsed: T; raw: string | null }>({
    parsed: initialValue,
    raw: null,
  });

  const getSnapshot = useCallback((): T => {
    const storage = getStorageInstance(storageType);
    if (!storage) return initialValue;
    try {
      const raw = storage.getItem(key);
      if (raw === null) {
        cacheRef.current = { parsed: initialValue, raw: null };
        return initialValue;
      }
      if (cacheRef.current.raw === raw) {
        return cacheRef.current.parsed;
      }
      const parsed = deserialize(raw);
      cacheRef.current = { parsed, raw };
      return parsed;
    } catch {
      return initialValue;
    }
  }, [deserialize, initialValue, key, storageType]);

  const getServerSnapshot = useCallback((): T => initialValue, [initialValue]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!isBrowser) return () => {};

      const handleStorage = (event: StorageEvent) => {
        if (
          event.key === key &&
          event.storageArea === getStorageInstance(storageType)
        ) {
          onStoreChange();
        }
      };

      const handleCustomSync = (event: Event) => {
        const detail = (
          event as CustomEvent<{ key: string; storageType: string }>
        ).detail;
        if (detail?.key === key && detail?.storageType === storageType) {
          onStoreChange();
        }
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener(STORAGE_SYNC_EVENT, handleCustomSync);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(STORAGE_SYNC_EVENT, handleCustomSync);
      };
    },
    [key, storageType],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const stateRef = useRef<T>(state);

  useIsomorphicLayoutEffect(() => {
    stateRef.current = state;
  });

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolvedNext =
        typeof next === "function"
          ? (next as (prev: T) => T)(stateRef.current)
          : next;
      stateRef.current = resolvedNext;

      const storage = getStorageInstance(storageType);
      if (!storage) return;
      try {
        const raw = serialize(resolvedNext);
        cacheRef.current = { parsed: resolvedNext, raw };
        storage.setItem(key, raw);
        window.dispatchEvent(
          new CustomEvent(STORAGE_SYNC_EVENT, {
            detail: { key, storageType },
          }),
        );
      } catch {}
    },
    [key, serialize, storageType],
  );

  const removeValue = useCallback(() => {
    stateRef.current = initialValue;
    cacheRef.current = { parsed: initialValue, raw: null };

    const storage = getStorageInstance(storageType);
    if (!storage) return;
    try {
      storage.removeItem(key);
      window.dispatchEvent(
        new CustomEvent(STORAGE_SYNC_EVENT, {
          detail: { key, storageType },
        }),
      );
    } catch {}
  }, [initialValue, key, storageType]);

  return [state, setValue, removeValue];
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: Omit<UseStorageStateOptions<T>, "storage">,
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  return useStorageState(key, initialValue, { ...options, storage: "local" });
}

export function useSessionStorage<T>(
  key: string,
  initialValue: T,
  options?: Omit<UseStorageStateOptions<T>, "storage">,
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  return useStorageState(key, initialValue, { ...options, storage: "session" });
}
