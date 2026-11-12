import { report } from "@/foundation/utils";

import type { RegistryOperation, RegistryState } from "./types";

type KeyListeners = Map<string | null, Set<() => void>>;

export function notifyListeners(listeners: Set<() => void> | undefined): void {
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      report("Registry listener", error);
    }
  }
}

export function getOrCreateKeyListeners(
  listenersByType: Map<string, KeyListeners>,
  type: string,
  key: string | null,
): Set<() => void> {
  let listeners = listenersByType.get(type);
  if (!listeners) {
    listeners = new Map();
    listenersByType.set(type, listeners);
  }
  let keyListeners = listeners.get(key);
  if (!keyListeners) {
    keyListeners = new Set();
    listeners.set(key, keyListeners);
  }
  return keyListeners;
}

/** Groups the keys touched by the operations under their registry type. */
export function collectChangedKeys(
  operations: RegistryOperation[],
  isValidTarget: (type: string, key: unknown) => boolean,
): Map<string, Set<string>> {
  const changedKeysByType = new Map<string, Set<string>>();
  for (const operation of operations) {
    if (!isValidTarget(operation?.type, operation?.key)) continue;
    let keys = changedKeysByType.get(operation.type);
    if (!keys) {
      keys = new Set();
      changedKeysByType.set(operation.type, keys);
    }
    keys.add(operation.key);
  }
  return changedKeysByType;
}

/**
 * Keeps per-type and per-key listeners and notifies the ones whose entries
 * differ between two registry states.
 */
export function createListenerRegistry() {
  const listenersByType = new Map<string, KeyListeners>();

  function subscribe(
    type: string,
    key: string | null | undefined,
    listener: () => void,
  ): () => void {
    const keyListeners = getOrCreateKeyListeners(
      listenersByType,
      type,
      key ?? null,
    );
    keyListeners.add(listener);

    return () => {
      keyListeners.delete(listener);
      if (keyListeners.size > 0) return;

      const listeners = listenersByType.get(type);
      if (listeners) {
        listeners.delete(key ?? null);
        if (listeners.size === 0) listenersByType.delete(type);
      }
    };
  }

  function notifyChanged(
    previousState: RegistryState,
    nextState: RegistryState,
    changedKeysByType: Map<string, Set<string>>,
  ): void {
    for (const [type, changedKeys] of changedKeysByType) {
      const previousRegistry = previousState[type] || {};
      const nextRegistry = nextState[type] || {};
      const typeListeners = listenersByType.get(type);
      let typeChanged = false;

      if (!typeListeners) continue;

      for (const key of changedKeys) {
        if (previousRegistry[key] === nextRegistry[key]) continue;
        typeChanged = true;
        notifyListeners(typeListeners.get(key));
      }

      if (typeChanged) {
        notifyListeners(typeListeners.get(null));
      }
    }
  }

  return { notifyChanged, subscribe };
}
