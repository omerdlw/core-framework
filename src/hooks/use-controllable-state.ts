"use client";

import { useCallback, useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";
import { type UseControllableStateOptions } from "./types";

export function useControllableState<T>({
  defaultValue,
  onChange,
  value,
}: UseControllableStateOptions<T>): [T, (next: T | ((prev: T) => T)) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useState<T>(defaultValue);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value as T) : uncontrolledValue;
  const valueRef = useRef<T>(currentValue);
  const onChangeRef = useRef(onChange);

  useIsomorphicLayoutEffect(() => {
    valueRef.current = currentValue;
    onChangeRef.current = onChange;
  });

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolvedNext =
        typeof next === "function"
          ? (next as (prev: T) => T)(valueRef.current)
          : next;
      if (!Object.is(valueRef.current, resolvedNext)) {
        if (!isControlled) {
          setUncontrolledValue(resolvedNext);
        }
        onChangeRef.current?.(resolvedNext);
      }
    },
    [isControlled],
  );

  return [currentValue, setValue];
}
