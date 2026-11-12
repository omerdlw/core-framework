"use client";

import { type RefObject, useCallback, useEffect } from "react";

/**
 * Calls `callback` when a pointer press lands outside the referenced element.
 */
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
