"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const activeFullscreenStateIds = new Set<string>();

const ACTIVE_FULLSCREEN_ROOT_SELECTOR =
  '[data-fullscreen-state-root="true"][data-affect-global-state="true"]';

let domObserver: MutationObserver | null = null;
let lastSnapshot = false;

function getDomSnapshot(): boolean {
  if (typeof document === "undefined") {
    return activeFullscreenStateIds.size > 0;
  }

  return document.querySelector(ACTIVE_FULLSCREEN_ROOT_SELECTOR) !== null;
}

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function emitIfSnapshotChanged(): void {
  const nextSnapshot = getDomSnapshot();

  if (nextSnapshot === lastSnapshot) {
    return;
  }

  lastSnapshot = nextSnapshot;
  emitChange();
}

function ensureDomObserver(): void {
  if (typeof document === "undefined" || domObserver || listeners.size === 0) {
    return;
  }

  domObserver = new MutationObserver(() => {
    emitIfSnapshotChanged();
  });

  domObserver.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: [
      "data-fullscreen-state",
      "data-fullscreen-state-root",
      "data-affect-global-state",
    ],
  });
}

function releaseDomObserver(): void {
  if (listeners.size > 0 || !domObserver) {
    return;
  }

  domObserver.disconnect();
  domObserver = null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureDomObserver();
  emitIfSnapshotChanged();

  return () => {
    listeners.delete(listener);
    releaseDomObserver();
  };
}

function getSnapshot(): boolean {
  return getDomSnapshot();
}

export function registerFullscreenState(id: string): void {
  activeFullscreenStateIds.add(id);
  emitIfSnapshotChanged();
}

export function unregisterFullscreenState(id: string): void {
  activeFullscreenStateIds.delete(id);
  emitIfSnapshotChanged();
}

export function useIsFullscreenStateActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
