"use client";

import { useSyncExternalStore } from "react";

const ACTIVE_ROOT_SELECTOR =
  '[data-fullscreen-state-root="true"][data-affect-global-state="true"]';

const OBSERVED_ATTRIBUTES = [
  "data-fullscreen-state",
  "data-fullscreen-state-root",
  "data-affect-global-state",
];

const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;
let lastSnapshot = false;

function getSnapshot(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(ACTIVE_ROOT_SELECTOR) !== null;
}

function emitIfChanged(): void {
  const next = getSnapshot();
  if (next === lastSnapshot) return;
  lastSnapshot = next;
  listeners.forEach((listener) => listener());
}

/** One MutationObserver is shared by all subscribers and lives while any remain. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!observer && typeof document !== "undefined") {
    observer = new MutationObserver(emitIfChanged);
    observer.observe(document.documentElement, {
      attributeFilter: OBSERVED_ATTRIBUTES,
      attributes: true,
      childList: true,
      subtree: true,
    });
  }
  emitIfChanged();

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || !observer) return;
    observer.disconnect();
    observer = null;
  };
}

/**
 * True while any fullscreen-state root that affects global state is on the page.
 */
export function useIsFullscreenStateActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
