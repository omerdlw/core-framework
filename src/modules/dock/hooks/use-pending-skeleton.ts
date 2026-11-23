"use client";

import { useEffect, useState } from "react";

import { useDockMotion } from "../motion";

/**
 * True once the front card's page change has stayed pending for the theme's
 * `timings.pendingSkeleton` seconds, so a fast navigation never blinks a
 * skeleton in and out.
 */
export function usePendingSkeleton(isPending: boolean): boolean {
  const delay = useDockMotion().timings.pendingSkeleton ?? 0;
  const [isDue, setIsDue] = useState(false);
  if (!isPending && isDue) setIsDue(false);

  useEffect(() => {
    if (!isPending || delay <= 0) return;
    const timer = setTimeout(() => setIsDue(true), delay * 1000);
    return () => clearTimeout(timer);
  }, [delay, isPending]);

  return isPending && (delay <= 0 || isDue);
}
