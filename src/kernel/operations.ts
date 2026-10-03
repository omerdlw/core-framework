import {
  DEFAULT_REGISTRY_SCOPE,
  DEFAULT_SOURCE,
  REGISTRY_SOURCE_PRIORITY,
} from "./constants";
import { isObject, shallowEqual } from "@/utils";
import {
  getSourceRank,
  hasOwnProperty,
  resolveInstanceId,
  resolveRegisterInput,
  resolveScope,
  resolveUnregisterInput,
} from "./utils";
import { validateRegistryKey } from "./schema";
import type {
  RegisterOperation,
  RegistryDefinitions,
  RegistryEntryRecords,
  RegistryMetadata,
  RegistryOperation,
  RegistrySourceOrOptions,
  RegistryState,
  SourceRecord,
  UnregisterOperation,
} from "./types";

type MaybeEntry = RegistryEntryRecords | null | undefined;

function createInitialRegistriesFor(
  definitions: RegistryDefinitions,
): RegistryState {
  return Object.fromEntries(
    Array.from(definitions.keys(), (type) => [type, {}]),
  );
}

function buildSourceRecord({
  source,
  value,
  instanceId = null,
  priority,
  timestamp,
  sequence,
  scope = DEFAULT_REGISTRY_SCOPE,
}: {
  source: string;
  value: unknown;
  instanceId?: string | null;
  priority: number;
  timestamp: number;
  sequence?: number;
  scope?: string;
}): SourceRecord {
  return {
    updatedAt: timestamp,
    sequence: Number.isFinite(sequence) ? (sequence as number) : timestamp,
    instanceId: typeof instanceId === "string" ? instanceId : null,
    priority,
    value,
    source,
    scope,
  };
}

export function createRecordKey(
  source: string,
  instanceId: string | null = null,
  scope: string = DEFAULT_REGISTRY_SCOPE,
): string {
  if (scope === DEFAULT_REGISTRY_SCOPE) {
    if (typeof instanceId === "string" && instanceId.length > 0) {
      return `instance:${JSON.stringify([source, instanceId])}`;
    }
    return `source:${JSON.stringify(source)}`;
  }
  if (typeof instanceId === "string" && instanceId.length > 0) {
    return `instance:${JSON.stringify([scope, source, instanceId])}`;
  }
  return `source:${JSON.stringify([scope, source])}`;
}

function getSourceRecords(
  entry: MaybeEntry,
  source: string,
  scope: string | null = null,
): { recordKey: string; record: SourceRecord | null }[] {
  if (!entry) return [];
  return Object.entries(entry)
    .map(([recordKey, rawRecord]) => ({
      recordKey,
      record: toSourceRecord(rawRecord, recordKey),
    }))
    .filter(
      ({ record }) =>
        record?.source === source && (scope === null || record.scope === scope),
    );
}

function getSourceRecord(
  entry: MaybeEntry,
  source: string,
  instanceId: string | null = null,
  scope: string = DEFAULT_REGISTRY_SCOPE,
): SourceRecord | null {
  const recordKey = createRecordKey(source, instanceId, scope);
  return toSourceRecord(entry?.[recordKey], source);
}

function resolveRecordPriority(options: unknown, source: string): number {
  if (isObject(options) && hasOwnProperty(options, "priority")) {
    const parsedPriority = Number(options.priority);
    if (Number.isFinite(parsedPriority)) return parsedPriority;
  }
  return REGISTRY_SOURCE_PRIORITY[source] ?? 0;
}

function toSourceRecord(
  rawValue: unknown,
  source: string = DEFAULT_SOURCE,
): SourceRecord | null {
  if (rawValue === undefined) return null;
  const rawRecord = rawValue as Record<string, unknown>;

  const isWrappedRecord =
    isObject(rawValue) &&
    hasOwnProperty(rawRecord, "value") &&
    hasOwnProperty(rawRecord, "updatedAt") &&
    hasOwnProperty(rawRecord, "priority") &&
    hasOwnProperty(rawRecord, "source");

  if (isWrappedRecord) {
    const parsedPriority = Number(rawRecord.priority);
    return {
      updatedAt: Number(rawRecord.updatedAt) || 0,
      sequence: Number(rawRecord.sequence) || Number(rawRecord.updatedAt) || 0,
      instanceId:
        typeof rawRecord.instanceId === "string" ? rawRecord.instanceId : null,
      priority: Number.isFinite(parsedPriority)
        ? parsedPriority
        : (REGISTRY_SOURCE_PRIORITY[source] ?? 0),
      source: typeof rawRecord.source === "string" ? rawRecord.source : source,
      scope:
        typeof rawRecord.scope === "string"
          ? rawRecord.scope
          : DEFAULT_REGISTRY_SCOPE,
      value: rawRecord.value,
    };
  }

  return {
    updatedAt: 0,
    sequence: 0,
    instanceId: null,
    priority: REGISTRY_SOURCE_PRIORITY[source] ?? 0,
    source,
    scope: DEFAULT_REGISTRY_SCOPE,
    value: rawValue,
  };
}

function compareRecords(a: SourceRecord, b: SourceRecord): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  const rankDiff = getSourceRank(a.source) - getSourceRank(b.source);
  if (rankDiff !== 0) return rankDiff;
  return (a.sequence ?? a.updatedAt) - (b.sequence ?? b.updatedAt);
}

function recordsHaveSameValue(
  prevRecord: SourceRecord | null,
  nextRecord: SourceRecord,
): boolean {
  if (Object.is(prevRecord?.value, nextRecord?.value)) return true;
  if (isObject(prevRecord?.value) && isObject(nextRecord?.value)) {
    return shallowEqual(prevRecord!.value, nextRecord.value);
  }
  return false;
}

function hasRecordChanged(
  prevRecord: SourceRecord | null,
  nextRecord: SourceRecord,
): boolean {
  if (!prevRecord) return true;
  return (
    prevRecord.priority !== nextRecord.priority ||
    prevRecord.source !== nextRecord.source ||
    prevRecord.instanceId !== nextRecord.instanceId ||
    prevRecord.scope !== nextRecord.scope ||
    !recordsHaveSameValue(prevRecord, nextRecord)
  );
}

function hasAnySourceRecord(entry: MaybeEntry): boolean {
  return Object.values(entry || {}).some(
    (rawRecord) => rawRecord !== undefined,
  );
}

function setSourceRecord(
  state: RegistryState,
  type: string,
  key: string,
  source: string,
  record: SourceRecord,
): RegistryState {
  const typeRegistry = state[type] || {};
  const currentEntry = typeRegistry[key] || {};
  const recordKey = createRecordKey(source, record.instanceId, record.scope);
  const prevRecord = toSourceRecord(currentEntry[recordKey], source);

  if (!hasRecordChanged(prevRecord, record)) {
    return state;
  }

  return {
    ...state,
    [type]: {
      ...typeRegistry,
      [key]: {
        ...currentEntry,
        [recordKey]: record,
      },
    },
  };
}

function removeSourceRecord(
  state: RegistryState,
  type: string,
  key: string,
  source: string,
  instanceId: string | null = null,
  scope: string | null = null,
): RegistryState {
  const typeRegistry = state[type];
  const currentEntry = typeRegistry?.[key];
  if (!typeRegistry || !currentEntry) return state;

  let activeRecords: { recordKey: string; record: SourceRecord }[] = [];

  if (
    typeof instanceId === "string" &&
    instanceId.length > 0 &&
    scope !== null
  ) {
    const safeScope = scope || DEFAULT_REGISTRY_SCOPE;
    const recordKey = createRecordKey(source, instanceId, safeScope);
    const record = getSourceRecord(currentEntry, source, instanceId, safeScope);

    if (record) activeRecords.push({ recordKey, record });
  } else {
    activeRecords = getSourceRecords(currentEntry, source, scope)
      .filter(({ record }) => !instanceId || record?.instanceId === instanceId)
      .filter((entry): entry is { recordKey: string; record: SourceRecord } =>
        Boolean(entry.record),
      );
  }

  if (activeRecords.length === 0) return state;

  const nextEntry = { ...currentEntry };
  activeRecords.forEach(({ recordKey }) => {
    delete nextEntry[recordKey];
  });

  if (!hasAnySourceRecord(nextEntry)) {
    const nextTypeRegistry = { ...typeRegistry };
    delete nextTypeRegistry[key];
    return { ...state, [type]: nextTypeRegistry };
  }

  return {
    ...state,
    [type]: { ...typeRegistry, [key]: nextEntry },
  };
}

function resolveEntryValueFor(
  definitions: RegistryDefinitions,
  type: string,
  entry: MaybeEntry,
  scope: string | null = null,
): unknown {
  if (!entry) return undefined;

  const activeRecords = Object.entries(entry)
    .map(([source, rawRecord]) => toSourceRecord(rawRecord, source))
    .filter(
      (record): record is SourceRecord =>
        record !== null && (scope === null || record.scope === scope),
    );

  if (activeRecords.length === 0) return undefined;

  const merge = definitions.get(type)?.merge;
  if (merge) {
    const sortedRecords = [...activeRecords].sort(compareRecords);
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

    let typeCache = entryCache.get(entry);
    if (!typeCache) {
      typeCache = new Map();
      entryCache.set(entry, typeCache);
    }

    const cacheKey = scope || "default";

    if (typeCache.has(cacheKey)) return typeCache.get(cacheKey);

    const value = resolveEntryValueFor(definitions, type, entry, scope);
    typeCache.set(cacheKey, value);
    return value;
  };
}

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
    const entry = state[operation.type]?.[operation.key];
    if (
      typeof operation.instanceId === "string" &&
      operation.instanceId.length > 0
    ) {
      return operation.scope === null
        ? getSourceRecords(entry, operation.source).some(
            ({ record }) => record?.instanceId === operation.instanceId,
          )
        : Boolean(
            getSourceRecord(
              entry,
              operation.source,
              operation.instanceId,
              operation.scope,
            ),
          );
    }
    return (
      getSourceRecords(entry, operation.source, operation.scope).length > 0
    );
  }
  return false;
}

function resolveEffectiveOperationsFor(
  definitions: RegistryDefinitions,
  state: RegistryState,
  operations: RegistryOperation[],
): { effectiveOperations: RegistryOperation[]; nextState: RegistryState } {
  const effectiveOperations: RegistryOperation[] = [];
  let nextState = state;

  operations.forEach((operation) => {
    if (!hasOperationEffectFor(definitions, nextState, operation)) return;
    effectiveOperations.push(operation);
    nextState = applyOperationFor(definitions, nextState, operation);
  });

  return { effectiveOperations, nextState };
}

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
