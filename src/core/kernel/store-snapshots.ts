import type { MaybeEntry } from "./operations-records";
import type { RegistryState } from "./types";

type ResolveValue = (
  type: string,
  entry: MaybeEntry,
  scope?: string | null,
) => unknown;

const SCOPE_KEY_SEPARATOR = "\u0000";

/**
 * Builds the snapshot readers for a registry. Results are cached per entry so
 * the same reference is returned until the underlying entry changes, which is
 * what useSyncExternalStore requires.
 */
export function createSnapshotReaders(
  getState: () => RegistryState,
  resolveValue: ResolveValue,
) {
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

  const getSnapshot = (
    type: string,
    key: string,
    scope: string | null = null,
  ): unknown => {
    const entry = getState()[type]?.[key];
    let snapshots = valueSnapshots.get(type);
    if (!snapshots) {
      snapshots = new Map();
      valueSnapshots.set(type, snapshots);
    }

    const cacheKey =
      scope === null ? key : `${scope}${SCOPE_KEY_SEPARATOR}${key}`;

    if (entry === undefined) {
      snapshots.delete(cacheKey);
      return undefined;
    }

    const cached = snapshots.get(cacheKey);
    if (cached && cached.entry === entry) return cached.value;

    const value = resolveValue(type, entry, scope);
    snapshots.set(cacheKey, { entry, value });
    return value;
  };

  const getEntriesSnapshot = (
    type: string,
    scope: string | null = null,
  ): Readonly<Record<string, unknown>> => {
    const typeRegistry = getState()[type] || {};

    const cacheKey = `${type}::${scope ?? "null"}`;
    const cached = entrySnapshots.get(cacheKey);

    if (cached?.typeRegistry === typeRegistry) return cached.value;

    const resolved: Record<string, unknown> = {};
    for (const key in typeRegistry) {
      if (Object.prototype.hasOwnProperty.call(typeRegistry, key)) {
        const value = resolveValue(type, typeRegistry[key], scope);
        if (value !== undefined) resolved[key] = value;
      }
    }

    const finalValue = Object.freeze(resolved);
    entrySnapshots.set(cacheKey, { typeRegistry, value: finalValue });
    return finalValue;
  };

  return { getEntriesSnapshot, getSnapshot };
}
