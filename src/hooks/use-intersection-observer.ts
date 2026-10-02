"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { isBrowser } from "../utils";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";
import {
  UseIntersectionObserverOptions,
  UseIntersectionObserverResult,
} from "./types";

export function useIntersectionObserver<T extends Element = Element>(
  targetRef: RefObject<T | null> | null | undefined,
  options: UseIntersectionObserverOptions = {},
): UseIntersectionObserverResult {
  const {
    enabled = true,
    freezeOnceVisible = false,
    onChange,
    root = null,
    rootMargin = "0px",
    threshold = 0,
  } = options;

  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const onChangeRef = useRef(onChange);

  useIsomorphicLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  const frozen = Boolean(entry?.isIntersecting && freezeOnceVisible);

  useEffect(() => {
    if (
      !isBrowser ||
      !enabled ||
      frozen ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const node = targetRef?.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([nextEntry]) => {
        if (!nextEntry) return;
        setEntry(nextEntry);
        onChangeRef.current?.(nextEntry);
      },
      { root, rootMargin, threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, frozen, root, rootMargin, targetRef, threshold]);

  return {
    entry,
    isIntersecting: Boolean(entry?.isIntersecting),
  };
}
