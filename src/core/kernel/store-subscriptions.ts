import { report } from "@/foundation/utils";

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
  listenersByType: Map<string, Map<string | null, Set<() => void>>>,
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
