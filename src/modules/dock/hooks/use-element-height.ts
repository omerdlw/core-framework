"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";

import { getObservedHeight, hasMeaningfulHeightChange } from "../model/layout";

export function useElementHeight(
  onHeightChange?: ((height: number) => void) | null,
  elementRef?: RefObject<HTMLElement | null>,
  shouldMeasure?: boolean,
  dependencyKey: unknown = null,
) {
  const lastHeightRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const callbackRef = useRef(onHeightChange);

  useLayoutEffect(() => {
    callbackRef.current = onHeightChange;
  }, [onHeightChange]);

  useLayoutEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastHeightRef.current = -1;

    if (!callbackRef.current) return;
    if (!shouldMeasure) {
      if (hasMeaningfulHeightChange(lastHeightRef.current, 0)) {
        lastHeightRef.current = 0;
        callbackRef.current(0);
      }
      return;
    }

    const element = elementRef?.current;
    if (!element) return;

    function publishHeight(nextHeight: number) {
      if (!hasMeaningfulHeightChange(lastHeightRef.current, nextHeight)) return;
      lastHeightRef.current = nextHeight;
      callbackRef.current?.(nextHeight);
    }

    let pendingHeight: number | null = null;
    function flushPendingHeight() {
      rafRef.current = null;
      if (pendingHeight == null) return;
      const heightToPublish = pendingHeight;
      pendingHeight = null;
      publishHeight(heightToPublish);
    }

    function scheduleMeasurement(nextHeight: number) {
      pendingHeight = nextHeight;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(flushPendingHeight);
    }

    publishHeight(element.offsetHeight || 0);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        scheduleMeasurement(getObservedHeight(entry, element));
      }
    });
    observer.observe(element);

    const handlePageShow = () => scheduleMeasurement(element.offsetHeight || 0);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") handlePageShow();
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [dependencyKey, elementRef, shouldMeasure]);
}
