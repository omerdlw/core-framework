import {
  DEFAULT_REGISTRY_SCOPE,
  DEFAULT_SOURCE,
  REGISTRY_SOURCE_PRIORITY,
} from "./constants";
import { isObject, shallowEqual } from "@/foundation/utils";
import { getSourceRank, hasOwnProperty } from "./utils";
import type {
  RegistryDefinitions,
  RegistryEntryRecords,
  RegistryState,
  SourceRecord,
} from "./types";

export type MaybeEntry = RegistryEntryRecords | null | undefined;

export function createInitialRegistriesFor(
  definitions: RegistryDefinitions,
): RegistryState {
  return Object.fromEntries(
    Array.from(definitions.keys(), (type) => [type, {}]),
  );
}

export function buildSourceRecord({
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
    sequence: Number.isFinite(sequence) ? sequence! : timestamp,
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

export function getSourceRecords(
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

export function getSourceRecord(
  entry: MaybeEntry,
  source: string,
  instanceId: string | null = null,
  scope: string = DEFAULT_REGISTRY_SCOPE,
): SourceRecord | null {
  const recordKey = createRecordKey(source, instanceId, scope);
  return toSourceRecord(entry?.[recordKey], source);
}

export function resolveRecordPriority(
  options: unknown,
  source: string,
): number {
  if (isObject(options) && hasOwnProperty(options, "priority")) {
    const parsedPriority = Number(options.priority);
    if (Number.isFinite(parsedPriority)) return parsedPriority;
  }
  return REGISTRY_SOURCE_PRIORITY[source] ?? 0;
}

export function toSourceRecord(
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

export function compareRecords(a: SourceRecord, b: SourceRecord): number {
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
    return shallowEqual(prevRecord.value, nextRecord.value);
  }
  return false;
}

export function hasRecordChanged(
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

export function setSourceRecord(
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

export function removeSourceRecord(
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
