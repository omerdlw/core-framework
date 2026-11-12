import { DEFAULT_SOURCE } from "./constants";
import {
  createRegistryOperations,
  createUnregisterOperation,
} from "./operations";
import { createRecordKey } from "./operations-records";
import { createRegistryTransaction } from "./runtime";
import { createBatchQueue } from "./store-batch";
import {
  createInitialState,
  type InitialRegistryEntries,
  normalizeInitialEntries,
} from "./store-entries";
import { createNoopHandle, createRegistrationHandle } from "./store-handles";
import { prepareRegisterOperation } from "./store-registration";
import { createSnapshotReaders } from "./store-snapshots";
import {
  collectChangedKeys,
  createListenerRegistry,
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

/**
 * Creates a registry store: a prioritized, observable collection of typed
 * entries.
 */
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

  const listeners = createListenerRegistry();
  const resolveCachedValue = ops.createResolverCache();
  const { getEntriesSnapshot, getSnapshot } = createSnapshotReaders(
    () => registries,
    resolveCachedValue,
  );

  const commit = (
    nextState: RegistryState,
    operations: RegistryOperation[] = [],
  ) => {
    if (registries === nextState) return;
    const previousState = registries;
    registries = nextState;

    listeners.notifyChanged(
      previousState,
      nextState,
      collectChangedKeys(operations, ops.isValidRegistryTarget),
    );
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
    const operations: RegistryOperation[] = [];

    executor(
      createBatchQueue({
        definitions,
        getStore: () => store,
        nextSequence: () => ++sequence,
        operations,
        ops,
        timestamp: Date.now(),
      }),
    );
    if (operations.length === 0) return 0;

    const { effectiveOperations, nextState } = ops.resolveEffectiveOperations(
      registries,
      operations,
    );
    if (effectiveOperations.length === 0) return 0;

    commit(nextState, effectiveOperations);
    return effectiveOperations.length;
  };

  const store = {
    batch,
    dispose,
    getEntriesSnapshot,
    getSnapshot,
    isCurrent,
    register,
    subscribe: listeners.subscribe,
    transaction: (
      executor: (tx: RegistryTransactionQueue) => void,
      metadata: RegistryMetadata = {},
    ) => createRegistryTransaction(store, metadata).run(executor),
    unregister,
  } as RegistryStore;
  return store;
}
