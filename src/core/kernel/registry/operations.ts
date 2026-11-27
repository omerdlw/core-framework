import { isObject } from "@/foundation/utils";
import { getOrInsert } from "@/foundation/utils/collections";

import type {
  RegisterOperation,
  RegistryDefinitions,
  RegistryMetadata,
  RegistryOperation,
  RegistrySourceOrOptions,
  RegistryState,
  SourceRecord,
  UnregisterOperation,
} from "../types/registry";
import {
  resolveInstanceId,
  resolveRegisterInput,
  resolveScope,
  resolveUnregisterInput,
} from "../utils";
import {
  buildSourceRecord,
  compareRecords,
  createInitialRegistriesFor,
  createRecordKey,
  findRecordsToRemove,
  getSourceRecord,
  getSourceRecords,
  hasAnySourceRecord,
  hasRecordChanged,
  type MaybeEntry,
  removeSourceRecord,
  resolveRecordPriority,
  setSourceRecord,
  toSourceRecord,
} from "./records";
import { validateRegistryKey } from "./schema";

export function createRegisterOperation(
  type: string,
  key: string,
  item: unknown,
  sourceOrOptions: RegistrySourceOrOptions | undefined,
  optionsArg: RegistryMetadata | undefined,
  timestamp: number,
  sequence: number = timestamp,
): RegisterOperation {
  const { source, options } = resolveRegisterInput(sourceOrOptions, optionsArg);
  const instanceId = resolveInstanceId(options);
  const scope = resolveScope(options);

  return {
    kind: "register",
    validation: options.validation,
    source,
    scope,
    record: buildSourceRecord({
      source,
      value: item,
      instanceId,
      priority: resolveRecordPriority(options, source),
      scope,
      timestamp,
      sequence,
    }),
    instanceId,
    type,
    key: typeof key === "string" ? key.trim() : key,
  };
}

export function createUnregisterOperation(
  type: string,
  key: string,
  sourceOrOptions: RegistrySourceOrOptions | undefined,
): UnregisterOperation {
  const { scope, source, instanceId } = resolveUnregisterInput(sourceOrOptions);
  return {
    kind: "unregister",
    instanceId,
    scope,
    source,
    type,
    key: typeof key === "string" ? key.trim() : key,
  };
}

function isValidRegistryTargetFor(
  definitions: RegistryDefinitions,
  type: string,
  key: unknown,
): boolean {
  return validateRegistryKey(type, key, definitions).valid;
}

function applyOperationFor(
  definitions: RegistryDefinitions,
  state: RegistryState,
  operation: RegistryOperation,
): RegistryState {
  if (!isValidRegistryTargetFor(definitions, operation?.type, operation?.key))
    return state;

  if (operation.kind === "register") {
    return setSourceRecord(
      state,
      operation.type,
      operation.key,
      operation.source,
      operation.record,
    );
  }
  if (operation.kind === "unregister") {
    return removeSourceRecord(
      state,
      operation.type,
      operation.key,
      operation.source,
      operation.instanceId,
      operation.scope,
    );
  }
  return state;
}

function unregisterHasEffect(
  entry: MaybeEntry,
  operation: UnregisterOperation,
): boolean {
  const { instanceId, scope, source } = operation;
  if (typeof instanceId !== "string" || instanceId.length === 0) {
    return getSourceRecords(entry, source, scope).length > 0;
  }
  if (scope === null) {
    return getSourceRecords(entry, source).some(
      ({ record }) => record?.instanceId === instanceId,
    );
  }
  return Boolean(getSourceRecord(entry, source, instanceId, scope));
}

function hasOperationEffectFor(
  definitions: RegistryDefinitions,
  state: RegistryState,
  operation: RegistryOperation,
): boolean {
  if (!isValidRegistryTargetFor(definitions, operation?.type, operation?.key))
    return false;

  if (operation.kind === "register") {
    const currentRecord = getSourceRecord(
      state[operation.type]?.[operation.key],
      operation.source,
      operation.instanceId,
      operation.scope,
    );
    return hasRecordChanged(currentRecord, operation.record);
  }

  if (operation.kind === "unregister") {
    return unregisterHasEffect(
      state[operation.type]?.[operation.key],
      operation,
    );
  }
  return false;
}

/**
 * Copy-on-write view of a registry state for applying many operations: each
 * touched type and entry is copied once, so a batch of n operations costs
 * O(n) instead of re-spreading the whole type registry per operation.
 * Untouched entries keep their identity (snapshot caches key on it).
 */
interface StateDraft {
  readonly base: RegistryState;
  readonly entries: Set<string>;
  state: RegistryState;
  readonly types: Set<string>;
}

function writableEntry(
  draft: StateDraft,
  type: string,
  key: string,
): RegistryState[string][string] {
  if (draft.state === draft.base) draft.state = { ...draft.base };
  if (!draft.types.has(type)) {
    draft.state[type] = { ...(draft.state[type] || {}) };
    draft.types.add(type);
  }
  const registry = draft.state[type];
  const id = `${type}\u0000${key}`;
  let entry = registry[key];
  if (!draft.entries.has(id) || !entry) {
    entry = { ...(entry || {}) };
    registry[key] = entry;
    draft.entries.add(id);
  }
  return entry;
}

function applyOperationToDraft(
  draft: StateDraft,
  operation: RegistryOperation,
): void {
  if (operation.kind === "register") {
    const entry = writableEntry(draft, operation.type, operation.key);
    const recordKey = createRecordKey(
      operation.source,
      operation.record.instanceId,
      operation.record.scope,
    );
    entry[recordKey] = operation.record;
    return;
  }
  const current = draft.state[operation.type]?.[operation.key];
  if (!current) return;
  const records = findRecordsToRemove(
    current,
    operation.source,
    operation.instanceId,
    operation.scope,
  );
  if (records.length === 0) return;
  const entry = writableEntry(draft, operation.type, operation.key);
  for (const { recordKey } of records) delete entry[recordKey];
  if (!hasAnySourceRecord(entry))
    delete draft.state[operation.type][operation.key];
}

function resolveEffectiveOperationsFor(
  definitions: RegistryDefinitions,
  state: RegistryState,
  operations: RegistryOperation[],
): { effectiveOperations: RegistryOperation[]; nextState: RegistryState } {
  const effectiveOperations: RegistryOperation[] = [];
  const draft: StateDraft = {
    base: state,
    entries: new Set(),
    state,
    types: new Set(),
  };

  for (const operation of operations) {
    if (!hasOperationEffectFor(definitions, draft.state, operation)) continue;
    effectiveOperations.push(operation);
    applyOperationToDraft(draft, operation);
  }

  return { effectiveOperations, nextState: draft.state };
}

/**
 * Creates the pure operations (apply, resolve, validate targets) for a set of
 * registry definitions.
 */
export function createRegistryOperations(definitions: RegistryDefinitions) {
  return Object.freeze({
    applyOperation: (state: RegistryState, operation: RegistryOperation) =>
      applyOperationFor(definitions, state, operation),
    createInitialRegistries: () => createInitialRegistriesFor(definitions),
    createResolverCache: () => createResolverCacheFor(definitions),
    hasOperationEffect: (state: RegistryState, operation: RegistryOperation) =>
      hasOperationEffectFor(definitions, state, operation),
    isRegistryType: (type: string) => definitions.get(type) !== undefined,
    isValidRegistryTarget: (type: string, key: unknown) =>
      isValidRegistryTargetFor(definitions, type, key),
    resolveEffectiveOperations: (
      state: RegistryState,
      operations: RegistryOperation[],
    ) => resolveEffectiveOperationsFor(definitions, state, operations),
    resolveEntryValue: (
      type: string,
      entry: MaybeEntry,
      scope: string | null = null,
    ) => resolveEntryValueFor(definitions, type, entry, scope),
  });
}

export type RegistryOperations = ReturnType<typeof createRegistryOperations>;

function resolveEntryValueFor(
  definitions: RegistryDefinitions,
  type: string,
  entry: MaybeEntry,
  scope: string | null = null,
): unknown {
  if (!entry) return undefined;

  const activeRecords: SourceRecord[] = [];
  for (const recordKey in entry) {
    if (!Object.prototype.hasOwnProperty.call(entry, recordKey)) continue;
    const record = toSourceRecord(entry[recordKey], recordKey);
    if (record !== null && (scope === null || record.scope === scope)) {
      activeRecords.push(record);
    }
  }

  if (activeRecords.length === 0) return undefined;

  // eslint-disable-next-line @typescript-eslint/unbound-method -- definition.merge is called unbound as merge(values); the registry-definition contract is a plain function that must not rely on this (pre-existing unbound call)
  const merge = definitions.get(type)?.merge;
  if (activeRecords.length === 1) {
    const [only] = activeRecords;
    return merge && isObject(only.value) ? merge([only.value]) : only.value;
  }
  if (merge) {
    const sortedRecords = activeRecords.sort(compareRecords);
    const mergeCandidate = sortedRecords.every((record) =>
      isObject(record.value),
    );

    if (mergeCandidate) {
      const values = sortedRecords.map(
        (record) => record.value as Record<string, unknown>,
      );
      return merge(values);
    }
    return sortedRecords[sortedRecords.length - 1].value;
  }

  return activeRecords.reduce((winner, current) =>
    compareRecords(current, winner) > 0 ? current : winner,
  ).value;
}

function createResolverCacheFor(
  definitions: RegistryDefinitions,
): (type: string, entry: MaybeEntry, scope?: string | null) => unknown {
  const entryCache = new WeakMap<object, Map<string, unknown>>();

  return (type: string, entry: MaybeEntry, scope: string | null = null) => {
    if (!entry || typeof entry !== "object") {
      return resolveEntryValueFor(definitions, type, entry, scope);
    }

    const typeCache = getOrInsert(entryCache, entry, () => new Map());

    const cacheKey = scope || "default";

    if (typeCache.has(cacheKey)) return typeCache.get(cacheKey);

    const value = resolveEntryValueFor(definitions, type, entry, scope);
    typeCache.set(cacheKey, value);
    return value;
  };
}
