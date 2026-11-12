"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { type FrameworkEventMap, globalEvents } from "@/foundation/events";

import type { UseGlobalEventOptions } from "./types";

interface TimerRef {
  current: ReturnType<typeof setTimeout> | null;
}

function clearTimerRef(ref: TimerRef): void {
  if (ref.current === null) return;
  clearTimeout(ref.current);
  ref.current = null;
}

/**
 * Subscribes to one or more framework events for the life of the component,
 * optionally debounced or throttled.
 */
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

    const deliverDebounced = (payload: never, waitMs: number) => {
      clearTimerRef(debounceTimerRef);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        onEvent(payload);
      }, waitMs);
    };

    const deliverThrottled = (payload: never, limitMs: number) => {
      const now = Date.now();
      const remaining = limitMs - (now - lastThrottleTimeRef.current);
      if (remaining <= 0) {
        clearTimerRef(throttleTimerRef);
        lastThrottleTimeRef.current = now;
        onEvent(payload);
      } else if (throttleTimerRef.current === null) {
        throttleTimerRef.current = setTimeout(() => {
          lastThrottleTimeRef.current = Date.now();
          throttleTimerRef.current = null;
          onEvent(payload);
        }, remaining);
      }
    };

    const handler = (payload: never) => {
      if (debounceMs != null && debounceMs > 0) {
        deliverDebounced(payload, debounceMs);
      } else if (throttleMs != null && throttleMs > 0) {
        deliverThrottled(payload, throttleMs);
      } else {
        onEvent(payload);
      }
    };

    const unsubs = events.map((ev) => globalEvents.subscribe(ev, handler));

    return () => {
      unsubs.forEach((unsub) => unsub());
      clearTimerRef(debounceTimerRef);
      clearTimerRef(throttleTimerRef);
    };
  }, [event, debounceMs, throttleMs]);
}
