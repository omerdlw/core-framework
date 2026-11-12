"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { globalEvents, type FrameworkEventMap } from "@/foundation/events";
import type { UseGlobalEventOptions } from "./types";

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
  const onEvent = useEffectEvent((payload: never) => callback?.(payload));
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThrottleTimeRef = useRef<number>(0);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          onEvent(payload);
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
          onEvent(payload);
        } else if (throttleTimerRef.current === null) {
          throttleTimerRef.current = setTimeout(() => {
            lastThrottleTimeRef.current = Date.now();
            throttleTimerRef.current = null;
            onEvent(payload);
          }, remaining);
        }
        return;
      }

      onEvent(payload);
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
