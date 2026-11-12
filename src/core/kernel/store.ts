import { DEFAULT_SOURCE } from "./constants";
import {
  createRegistryOperations,
  createUnregisterOperation,
} from "./operations";
import { createRecordKey } from "./operations-records";
import { createRegistryTransaction } from "./runtime";
import {
  createInitialState,
  type InitialRegistryEntries,
  normalizeInitialEntries,
} from "./store-entries";
import { createNoopHandle, createRegistrationHandle } from "./store-handles";
import { prepareRegisterOperation } from "./store-registration";
import {
  getOrCreateKeyListeners,
  notifyListeners,
} from "./store-subscriptions";
import type {
  RegisterOperation,
  RegistrationHandle,
  RegistryDefinitions,
  RegistryMetadata,
  RegistryOperation,
  RegistryQueue,
  RegistrySourceOrOptions,
  RegistryState,
  RegistryStore,
  RegistryTransactionQueue,
} from "./types";

const NO_DEFINITIONS: RegistryDefinitions = new Map();

export function createRegistryStore(
  initialEntries: InitialRegistryEntries = [],
  definitions: RegistryDefinitions = NO_DEFINITIONS,
): RegistryStore {
  const ops = createRegistryOperations(definitions);
  let registries = createInitialState(ops, definitions, initialEntries);
  let sequence = normalizeInitialEntries(initialEntries).reduce(
    (count, entry) => count + Object.keys(entry.items).length,
    0,
  );

  const listenersByType = new Map<
    string,
    Map<string | null, Set<() => void>>
  >();
  const entrySnapshots = new Map<
    string,
    {
      typeRegistry: RegistryState[string];
      value: Readonly<Record<string, unknown>>;
    }
  >();
  const valueSnapshots = new Map<
    string,
    Map<
      string,
      { entry: RegistryState[string][string] | undefined; value: unknown }
    >
  >();
  const resolveCachedValue = ops.createResolverCache();

  const subscribe = (
    type: string,
    key: string | null | undefined,
    listener: () => void,
  ) => {
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
  };

  const commit = (
    nextState: RegistryState,
    operations: RegistryOperation[] = [],
  ) => {
    if (registries === nextState) return;
    const previousState = registries;
    registries = nextState;

    const changedKeysByType = new Map<string, Set<string>>();
    for (const operation of operations) {
      if (!ops.isValidRegistryTarget(operation?.type, operation?.key)) continue;
      let keys = changedKeysByType.get(operation.type);
      if (!keys) {
        keys = new Set();
        changedKeysByType.set(operation.type, keys);
      }
      keys.add(operation.key);
    }

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
  };

  const isCurrent = (operation: RegisterOperation) => {
    const entry = registries[operation.type]?.[operation.key];
    const recordKey = createRecordKey(
      operation.source,
      operation.instanceId,
      operation.scope,
    );
    return entry?.[recordKey] === operation.record;
  };

  const dispose = (
    operation: RegisterOperation,
    _reason = "manual",
  ): boolean => {
    if (!isCurrent(operation)) return false;
    const unregisterOperation = createUnregisterOperation(
      operation.type,
      operation.key,
      {
        source: operation.source,
        instanceId: operation.instanceId,
        scope: operation.scope,
      },
    );

    if (!ops.hasOperationEffect(registries, unregisterOperation)) return false;
    commit(ops.applyOperation(registries, unregisterOperation), [
      unregisterOperation,
    ]);
    return true;
  };

  const register = (
    type: string,
    key: string,
    item: unknown,
    sourceOrOptions: RegistrySourceOrOptions = DEFAULT_SOURCE,
    optionsArg: RegistryMetadata = {},
  ): RegistrationHandle => {
    const prepared = prepareRegisterOperation(
      ops,
      definitions,
      type,
      key,
      item,
      sourceOrOptions,
      optionsArg,
      Date.now(),
      ++sequence,
    );
    if ("rejected" in prepared) return prepared.rejected;

    const { operation } = prepared;
    if (!ops.hasOperationEffect(registries, operation)) {
      return createNoopHandle("ignored", "unchanged");
    }

    commit(ops.applyOperation(registries, operation), [operation]);
    return createRegistrationHandle(store, operation);
  };

  const unregister = (
    type: string,
    key: string,
    sourceOrOptions: RegistrySourceOrOptions = DEFAULT_SOURCE,
  ): void => {
    if (!ops.isValidRegistryTarget(type, key)) return;
    const operation = createUnregisterOperation(type, key, sourceOrOptions);
    if (!ops.hasOperationEffect(registries, operation)) return;

    commit(ops.applyOperation(registries, operation), [operation]);
  };

  const batch = (executor: (queue: RegistryQueue) => void): number => {
    if (typeof executor !== "function") return 0;
    const timestamp = Date.now();
    const operations: RegistryOperation[] = [];

    const queue: RegistryQueue = {
      register: (
        type: string,
        key: string,
        item: unknown,
        sourceOrOptions: RegistrySourceOrOptions = DEFAULT_SOURCE,
        optionsArg: RegistryMetadata = {},
      ): RegistrationHandle => {
        const prepared = prepareRegisterOperation(
          ops,
          definitions,
          type,
          key,
          item,
          sourceOrOptions,
          optionsArg,
          timestamp,
          ++sequence,
        );
        if ("rejected" in prepared) return prepared.rejected;

        operations.push(prepared.operation);
        return createRegistrationHandle(store, prepared.operation);
      },
      unregister: (
        type: string,
        key: string,
        sourceOrOptions: RegistrySourceOrOptions = DEFAULT_SOURCE,
      ): void => {
        if (!ops.isValidRegistryTarget(type, key)) return;
        operations.push(createUnregisterOperation(type, key, sourceOrOptions));
      },
    };

    executor(queue);
    if (operations.length === 0) return 0;

    const { effectiveOperations, nextState } = ops.resolveEffectiveOperations(
      registries,
      operations,
    );
    if (effectiveOperations.length === 0) return 0;

    commit(nextState, effectiveOperations);
    return effectiveOperations.length;
  };

  const getSnapshot = (
    type: string,
    key: string,
    scope: string | null = null,
  ): unknown => {
    const entry = registries[type]?.[key];
    let snapshots = valueSnapshots.get(type);
    if (!snapshots) {
      snapshots = new Map();
      valueSnapshots.set(type, snapshots);
    }

    const cacheKey = scope === null ? key : `${scope}\u0000${key}`;

    if (entry === undefined) {
      snapshots.delete(cacheKey);
      return undefined;
    }

    const cached = snapshots.get(cacheKey);
    if (cached && cached.entry === entry) return cached.value;

    const value = resolveCachedValue(type, entry, scope);
    snapshots.set(cacheKey, { entry, value });
    return value;
  };

  const getEntriesSnapshot = (
    type: string,
    scope: string | null = null,
  ): Readonly<Record<string, unknown>> => {
    const typeRegistry = registries[type] || {};

    const cacheKey = `${type}::${scope ?? "null"}`;
    const cached = entrySnapshots.get(cacheKey);

    if (cached?.typeRegistry === typeRegistry) return cached.value;

    const resolved: Record<string, unknown> = {};
    for (const key in typeRegistry) {
      if (Object.prototype.hasOwnProperty.call(typeRegistry, key)) {
        const value = resolveCachedValue(type, typeRegistry[key], scope);
        if (value !== undefined) resolved[key] = value;
      }
    }

    const finalValue = Object.freeze(resolved);
    entrySnapshots.set(cacheKey, { typeRegistry, value: finalValue });
    return finalValue;
  };

  const store = {
    batch,
    dispose,
    getEntriesSnapshot,
    getSnapshot,
    isCurrent,
    register,
    subscribe,
    transaction: (
      executor: (tx: RegistryTransactionQueue) => void,
      metadata: RegistryMetadata = {},
    ) => createRegistryTransaction(store, metadata).run(executor),
    unregister,
  } as RegistryStore;
  return store;
}
