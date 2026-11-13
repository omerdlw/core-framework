"use client";

import { useEffect, useRef } from "react";

import { acquireGlobalScrollLock } from "@/foundation/utils";

import { dispatchSmoothScrollLock } from "../lib/dom";

/** Locks page scrolling while a modal is visible and always releases it on unmount. */
export function useModalScrollLock(isModalVisible: boolean) {
  const releaseScrollLockRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isModalVisible) {
      if (!releaseScrollLockRef.current)
        releaseScrollLockRef.current = acquireGlobalScrollLock();
    } else if (releaseScrollLockRef.current) {
      releaseScrollLockRef.current();
      releaseScrollLockRef.current = null;
    }
    dispatchSmoothScrollLock(isModalVisible);
  }, [isModalVisible]);
  useEffect(() => {
    return () => {
      releaseScrollLockRef.current?.();
      releaseScrollLockRef.current = null;
      dispatchSmoothScrollLock(false);
    };
  }, []);
}
