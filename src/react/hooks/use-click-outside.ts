"use client";

import { useCallback, useEffect, type RefObject } from "react";

export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null> | null | undefined,
  callback?: (event: PointerEvent) => void,
): void {
  const handlePointer = useCallback(
    (event: PointerEvent) => {
      if (ref?.current && !ref.current.contains(event.target as Node)) {
        callback?.(event);
      }
    },
    [callback, ref],
  );

  useEffect(() => {
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [handlePointer]);
}
