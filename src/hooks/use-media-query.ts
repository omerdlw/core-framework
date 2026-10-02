"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isBrowser } from "../utils";

export function useMediaQuery(
  query: string,
  serverFallback: boolean = false,
): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!isBrowser || !query || typeof window.matchMedia !== "function") {
        return () => {};
      }
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onStoreChange);
      return () => mediaQueryList.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (!isBrowser || !query || typeof window.matchMedia !== "function") {
      return serverFallback;
    }
    return window.matchMedia(query).matches;
  }, [query, serverFallback]);

  const getServerSnapshot = useCallback(() => serverFallback, [serverFallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
