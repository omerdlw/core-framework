import { isValidElement } from "react";
import {
  createRecordKey,
  createRegisterOperation,
  createRegistryOperations,
  createUnregisterOperation,
  type RegistryOperations,
} from "./operations";
import {
  DEFAULT_SOURCE,
  REGISTRY_SOURCES,
  REGISTRY_VALIDATION_MODES,
  validateRegistryMetadata,
  validateRegistryValue,
} from "./schema";
import { createRegistryTransaction } from "./runtime";
import type {
  AppRegistryEntry,
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
import { report } from "@/utils";

export type InitialRegistryEntries = readonly AppRegistryEntry[];

const NO_DEFINITIONS: RegistryDefinitions = new Map();

function createNoopHandle(
  status: RegistrationHandle["status"] = "rejected",
  reason = "unknown",
): RegistrationHandle {
  const handle: RegistrationHandle = Object.assign(() => false, {
    active: false,
    dispose: () => false,
    instanceId: null,
    key: "",
    priority: 0,
    reason,
    source: "",
    status,
    type: "",
    update: (): RegistrationHandle => handle,
    updatedAt: 0,
    validation: "warn",
  });
  return handle;
}

const NOOP_HANDLE: RegistrationHandle = createNoopHandle();

function isNoopHandle(handle: RegistrationHandle | null | undefined): boolean {
  return (
    handle === NOOP_HANDLE ||
    handle?.status === "rejected" ||
    handle?.status === "ignored"
  );
}

function cloneRegistryValue<T>(
  value: T,
  seen = new WeakMap<object, unknown>(),
): T {
  if (value === null || typeof value !== "object" || isValidElement(value)) {
    return value;
  }

  const prototype = Object.getPrototypeOf(value);
  const isPlainObject =
    !Array.isArray(value) &&
    (prototype === Object.prototype || prototype === null);

  if (!Array.isArray(value) && !isPlainObject) return value;
  if (seen.has(value)) return seen.get(value) as T;

  const source = value as Record<string, unknown>;
  const clone = (Array.isArray(value) ? [] : {}) as Record<string, unknown>;
  seen.set(value, clone);

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      clone[key] = cloneRegistryValue(source[key], seen);
    }
  }

  return clone as T;
}

function normalizeInitialEntries(entries: unknown): AppRegistryEntry[] {
  return (Array.isArray(entries) ? entries : []).filter(
    (entry): entry is AppRegistryEntry =>
      entry?.type && entry?.items && typeof entry.items === "object",
  );
}

function createInitialState(
  ops: RegistryOperations,
  definitions: RegistryDefinitions,
  entries: unknown,
): RegistryState {
  const normalizedEntries = normalizeInitialEntries(entries);
  if (normalizedEntries.length === 0) return ops.createInitialRegistries();

  const timestamp = Date.now();
  let sequence = 0;
  let state = ops.createInitialRegistries();

  normalizedEntries.forEach((entry) => {
    const source = entry.source || REGISTRY_SOURCES.STATIC;
    const options: RegistryMetadata = {
      ...(entry.options || {}),
      instanceId:
        entry.instanceId || entry.options?.instanceId || "registry-initial",
    };

    Object.entries(entry.items).forEach(([key, value]) => {
      const validation = validateRegistration(
        definitions,
        entry.type,
        key,
        value,
        source,
        options,
      );
      if (!validation.valid) return;

      const operation = createRegisterOperation(
        entry.type,
        key,
        cloneRegistryValue(value),
        source,
        options,
        timestamp,
        ++sequence,
      );
      if (ops.hasOperationEffect(state, operation)) {
        state = ops.applyOperation(state, operation);
      }
    });
  });
  return state;
}

function notifyListeners(listeners: Set<() => void> | undefined): void {
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      report("Registry listener", error);
    }
  }
}

function getOrCreateKeyListeners(
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

function resolveRegistrationOptions(
  sourceOrOptions: RegistrySourceOrOptions | undefined,
  optionsArg?: RegistryMetadata,
): RegistryMetadata {
  if (sourceOrOptions && typeof sourceOrOptions === "object")
    return sourceOrOptions;
  return optionsArg && typeof optionsArg === "object" ? optionsArg : {};
}

function validateRegistration(
  definitions: RegistryDefinitions,
  type: string,
  key: string,
  value: unknown,
  sourceOrOptions: RegistrySourceOrOptions | undefined,
  optionsArg?: RegistryMetadata,
): { issues?: string[]; reason?: string; valid: boolean } {
  const options = resolveRegistrationOptions(sourceOrOptions, optionsArg);
  const metadataValidation = validateRegistryMetadata(options);
  const isStrict = options.validation === REGISTRY_VALIDATION_MODES.STRICT;

  if (!metadataValidation.valid && isStrict) {
    return {
      issues: metadataValidation.issues,
      reason: "invalid-metadata",
      valid: false,
    };
  }

  const validation = validateRegistryValue(type, key, value, definitions);
  if (validation.valid) return { valid: true };

  if (!isStrict) {
    report(`Registry ${type} "${key}" is invalid`, validation.issues, "warn");
  }

  return {
    issues: validation.issues,
    reason: "invalid-value",
    valid: !isStrict,
  };
}

function createRegistrationHandle(
  store: RegistryStore,
  operation: RegisterOperation,
): RegistrationHandle {
  let disposed = false;
  const dispose = (reason = "manual") => {
    if (disposed) return false;
    disposed = true;
    return store.dispose(operation, reason);
  };

  const handle = ((reason?: string) => dispose(reason)) as RegistrationHandle;
  handle.dispose = dispose;

  handle.update = (value: unknown, options: RegistryMetadata = {}) => {
    if (disposed || !store.isCurrent(operation)) return NOOP_HANDLE;
    const nextHandle = store.register(
      operation.type,
      operation.key,
      value,
      operation.source,
      {
        ...(typeof options === "object" ? options : {}),
        instanceId: operation.instanceId,
        priority: operation.record.priority,
        ...(operation.scope ? { scope: operation.scope } : {}),
        ...(operation.validation ? { validation: operation.validation } : {}),
      },
    );
    if (isNoopHandle(nextHandle)) return handle;
    disposed = true;
    return nextHandle;
  };

  Object.defineProperties(handle, {
    active: {
      enumerable: true,
      get: () => !disposed && store.isCurrent(operation),
    },
    instanceId: { enumerable: true, value: operation.instanceId },
    key: { enumerable: true, value: operation.key },
    priority: { enumerable: true, value: operation.record.priority },
    source: { enumerable: true, value: operation.source },
    status: {
      enumerable: true,
      get: () =>
        disposed
          ? "disposed"
          : store.isCurrent(operation)
            ? "active"
            : "superseded",
    },
    type: { enumerable: true, value: operation.type },
    updatedAt: { enumerable: true, value: operation.record.updatedAt },
    validation: { enumerable: true, value: operation.validation || "warn" },
  });

  return handle as RegistrationHandle;
}

function prepareRegisterOperation(
  ops: RegistryOperations,
  definitions: RegistryDefinitions,
  type: string,
  key: string,
  item: unknown,
  sourceOrOptions: RegistrySourceOrOptions,
  optionsArg: RegistryMetadata,
  timestamp: number,
  sequence: number,
): { operation: RegisterOperation } | { rejected: RegistrationHandle } {
  if (!ops.isValidRegistryTarget(type, key)) {
    return { rejected: createNoopHandle("rejected", "invalid-target") };
  }

  const validation = validateRegistration(
    definitions,
    type,
    key,
    item,
    sourceOrOptions,
    optionsArg,
  );
  if (!validation.valid) {
    return { rejected: createNoopHandle("rejected", validation.reason) };
  }

  return {
    operation: createRegisterOperation(
      type,
      key,
      cloneRegistryValue(item),
      sourceOrOptions,
      optionsArg,
      timestamp,
      sequence,
    ),
  };
}

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
