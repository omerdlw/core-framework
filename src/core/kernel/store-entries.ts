import { createRegisterOperation, type RegistryOperations } from "./operations";
import { REGISTRY_SOURCES } from "./constants";
import { cloneRegistryValue, validateRegistration } from "./store-registration";
import type {
  AppRegistryEntry,
  RegistryDefinitions,
  RegistryMetadata,
  RegistryState,
} from "./types";

export type InitialRegistryEntries = readonly AppRegistryEntry[];

export function normalizeInitialEntries(entries: unknown): AppRegistryEntry[] {
  return (
    Array.isArray(entries) ? (entries as Partial<AppRegistryEntry>[]) : []
  ).filter((entry): entry is AppRegistryEntry =>
    Boolean(entry?.type && entry?.items && typeof entry.items === "object"),
  );
}

export function createInitialState(
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
