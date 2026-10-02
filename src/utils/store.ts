import { report } from "./report";
export interface ExternalStore<TState = unknown> {
  readonly getSnapshot: () => TState;
  readonly publish: (
    nextState: TState | ((currentState: TState) => TState),
  ) => boolean;
  readonly setState: (
    updater: Partial<TState> | ((currentState: TState) => TState),
  ) => boolean;
  readonly subscribe: (listener: () => void) => () => void;
}

function freezeStoreSnapshot<TState>(state: TState): TState {
  if (
    process.env.NODE_ENV === "production" ||
    !state ||
    typeof state !== "object"
  ) {
    return state;
  }

  const seen = new WeakSet<object>();
  const freeze = (value: object): void => {
    if (seen.has(value) || Object.isFrozen(value)) return;
    seen.add(value);

    const prototype = Object.getPrototypeOf(value);
    if (
      Array.isArray(value) ||
      prototype === Object.prototype ||
      prototype === null
    ) {
      for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && "value" in descriptor && descriptor.value !== null) {
          if (typeof descriptor.value === "object") freeze(descriptor.value);
        }
      }
    }

    Object.freeze(value);
  };

  freeze(state);
  return state;
}

export interface CreateStoreOptions {
  freezeSnapshots?: boolean;
}

export function createStore<TState = Record<string, unknown>>(
  initialState: TState,
  { freezeSnapshots = true }: CreateStoreOptions = {},
): ExternalStore<TState> {
  const listeners = new Set<() => void>();
  const prepare = freezeSnapshots
    ? freezeStoreSnapshot
    : <T>(state: T): T => state;
  let snapshot = prepare(initialState);

  const publish = (
    nextStateOrUpdater: TState | ((currentState: TState) => TState),
  ): boolean => {
    const nextState =
      typeof nextStateOrUpdater === "function"
        ? (nextStateOrUpdater as (currentState: TState) => TState)(snapshot)
        : nextStateOrUpdater;
    if (Object.is(snapshot, nextState)) return false;
    snapshot = prepare(nextState);

    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        report("CoreStore subscriber", error, "warn");
      }
    }
    return true;
  };

  const setState = (
    updater: Partial<TState> | ((currentState: TState) => TState),
  ): boolean => {
    if (typeof updater === "function") {
      return publish(updater as (currentState: TState) => TState);
    }
    if (
      snapshot &&
      typeof snapshot === "object" &&
      updater &&
      typeof updater === "object"
    ) {
      return publish({ ...snapshot, ...updater });
    }
    return publish(updater as TState);
  };

  return Object.freeze({
    getSnapshot() {
      return snapshot;
    },
    publish,
    setState,
    subscribe(listener: () => void) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
