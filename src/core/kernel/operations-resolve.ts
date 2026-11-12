import { isObject } from "@/foundation/utils";

import {
  compareRecords,
  type MaybeEntry,
  toSourceRecord,
} from "./operations-records";
import type { RegistryDefinitions, SourceRecord } from "./types";

export function resolveEntryValueFor(
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

  // eslint-disable-next-line @typescript-eslint/unbound-method -- definition.merge is called unbound as merge(values); the registry-definition contract is a plain function that must not rely on this (pre-existing unbound call)
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

export function createResolverCacheFor(
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
