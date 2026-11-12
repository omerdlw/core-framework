"use client";

import { type RefObject, useEffect, useEffectEvent } from "react";

/**
 * Calls `callback` when a pointer press lands outside the referenced element.
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null> | null | undefined,
  callback?: (event: PointerEvent) => void,
): void {
  const onPointer = useEffectEvent((event: PointerEvent) => {
    if (ref?.current && !ref.current.contains(event.target as Node)) {
      callback?.(event);
    }
  });

  useEffect(() => {
    const handlePointer = (event: PointerEvent) => onPointer(event);
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, []);
}
