import { isObject, shallowEqual } from "@/foundation/utils";

import {
  DEFAULT_REGISTRY_SCOPE,
  DEFAULT_SOURCE,
  REGISTRY_SOURCE_PRIORITY,
} from "./constants";
import type {
  RegistryDefinitions,
  RegistryEntryRecords,
  RegistryState,
  SourceRecord,
} from "./types";
import { getSourceRank, hasOwnProperty } from "./utils";

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

// NUL never appears in sources, instance ids or scopes, so joining on it is
// unambiguous and avoids JSON.stringify on every register and lookup.
const SEP = "\u0000";

export function createRecordKey(
  source: string,
  instanceId: string | null = null,
  scope: string = DEFAULT_REGISTRY_SCOPE,
): string {
  const hasInstance = typeof instanceId === "string" && instanceId.length > 0;
  if (scope === DEFAULT_REGISTRY_SCOPE) {
    return hasInstance
      ? `i${SEP}${source}${SEP}${instanceId}`
      : `s${SEP}${source}`;
  }
  return hasInstance
    ? `I${SEP}${scope}${SEP}${source}${SEP}${instanceId}`
    : `S${SEP}${scope}${SEP}${source}`;
}

export function getSourceRecords(
  entry: MaybeEntry,
  source: string,
  scope: string | null = null,
): { recordKey: string; record: SourceRecord | null }[] {
  if (!entry) return [];
  const matches: { recordKey: string; record: SourceRecord | null }[] = [];
  for (const recordKey in entry) {
    if (!hasOwnProperty(entry, recordKey)) continue;
    const record = toSourceRecord(entry[recordKey], recordKey);
    if (
      record?.source === source &&
      (scope === null || record.scope === scope)
    ) {
      matches.push({ recordKey, record });
    }
  }
  return matches;
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

/** True for a record built by `buildSourceRecord`: usable without copying. */
function isNormalizedRecord(value: unknown): value is SourceRecord {
  if (!isObject(value)) return false;
  const record = value as Partial<SourceRecord>;
  return (
    typeof record.priority === "number" &&
    Number.isFinite(record.priority) &&
    typeof record.updatedAt === "number" &&
    typeof record.sequence === "number" &&
    typeof record.source === "string" &&
    typeof record.scope === "string" &&
    (record.instanceId === null || typeof record.instanceId === "string") &&
    hasOwnProperty(record, "value")
  );
}

export function toSourceRecord(
  rawValue: unknown,
  source: string = DEFAULT_SOURCE,
): SourceRecord | null {
  if (rawValue === undefined) return null;
  // The registry only stores records it built itself; reading them is the
  // hot path and must not allocate.
  if (isNormalizedRecord(rawValue)) return rawValue;
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

export function hasAnySourceRecord(entry: MaybeEntry): boolean {
  if (!entry) return false;
  for (const recordKey in entry) {
    if (hasOwnProperty(entry, recordKey) && entry[recordKey] !== undefined) {
      return true;
    }
  }
  return false;
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

export interface KeyedRecord {
  recordKey: string;
  record: SourceRecord;
}

/** Records an unregister targets: one exact record, or every match. */
export function findRecordsToRemove(
  entry: RegistryEntryRecords,
  source: string,
  instanceId: string | null,
  scope: string | null,
): KeyedRecord[] {
  if (
    typeof instanceId === "string" &&
    instanceId.length > 0 &&
    scope !== null
  ) {
    const safeScope = scope || DEFAULT_REGISTRY_SCOPE;
    const record = getSourceRecord(entry, source, instanceId, safeScope);
    if (!record) return [];
    return [
      { recordKey: createRecordKey(source, instanceId, safeScope), record },
    ];
  }

  return getSourceRecords(entry, source, scope)
    .filter(({ record }) => !instanceId || record?.instanceId === instanceId)
    .filter((candidate): candidate is KeyedRecord => Boolean(candidate.record));
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

  const activeRecords = findRecordsToRemove(
    currentEntry,
    source,
    instanceId,
    scope,
  );

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
