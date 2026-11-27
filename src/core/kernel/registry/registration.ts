import { isValidElement } from "react";

import { isPlainObject, report } from "@/foundation/utils";

import { REGISTRY_SOURCES, REGISTRY_VALIDATION_MODES } from "../constants";
import type {
  AppRegistryEntry,
  RegisterOperation,
  RegistrationHandle,
  RegistryDefinitions,
  RegistryMetadata,
  RegistrySourceOrOptions,
  RegistryState,
  RegistryStore,
} from "../types/registry";
import { hasOwnProperty } from "../utils";
import { createRegisterOperation, type RegistryOperations } from "./operations";
import { validateRegistryMetadata, validateRegistryValue } from "./schema";

const DEFAULT_VALIDATION = REGISTRY_VALIDATION_MODES.WARN;
const NOOP_HANDLE: RegistrationHandle = createNoopHandle();

// ---- Values and validation ----

/** Deep-copies plain objects and arrays; elements and class instances are kept as they are. */
function cloneRegistryValue<T>(
  value: T,
  seen = new WeakMap<object, unknown>(),
): T {
  if (value === null || typeof value !== "object" || isValidElement(value)) {
    return value;
  }

  if (!Array.isArray(value) && !isPlainObject(value)) return value;
  if (seen.has(value)) return seen.get(value) as T;

  const source = value as Record<string, unknown>;
  const clone = (Array.isArray(value) ? [] : {}) as Record<string, unknown>;
  seen.set(value, clone);

  for (const key in source) {
    if (hasOwnProperty(source, key)) {
      clone[key] = cloneRegistryValue(source[key], seen);
    }
  }

  return clone as T;
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

export function prepareRegisterOperation(
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

// ---- Handles ----

export function createNoopHandle(
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
    validation: DEFAULT_VALIDATION,
  });
  return handle;
}

function isNoopHandle(handle: RegistrationHandle | null | undefined): boolean {
  return handle?.status === "rejected" || handle?.status === "ignored";
}

export function createRegistrationHandle(
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
      get: () => {
        if (disposed) return "disposed";
        return store.isCurrent(operation) ? "active" : "superseded";
      },
    },
    type: { enumerable: true, value: operation.type },
    updatedAt: { enumerable: true, value: operation.record.updatedAt },
    validation: {
      enumerable: true,
      value: operation.validation || DEFAULT_VALIDATION,
    },
  });

  return handle;
}

// ---- Initial state ----

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
