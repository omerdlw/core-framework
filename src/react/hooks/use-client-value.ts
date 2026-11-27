"use client";

import { useSyncExternalStore } from "react";

const subscribeNothing = () => () => {};
const onClient = () => true;

/**
 * A browser-only value that never changes: `serverValue` during server
 * rendering and hydration, then `read()` on the client. `read` must return
 * the same value on every call.
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribeNothing, read, () => serverValue);
}

/**
 * False during server rendering and hydration, true on the client.
 */
export function useIsClient(): boolean {
  return useClientValue(onClient, false);
}

const readBody = () => document.body;

/**
 * `document.body` on the client, null during server rendering and hydration.
 */
export function usePortalTarget(): HTMLElement | null {
  return useClientValue<HTMLElement | null>(readBody, null);
}
