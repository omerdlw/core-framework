import {
  buildSourceRecord,
  createInitialRegistriesFor,
  getSourceRecord,
  getSourceRecords,
  hasRecordChanged,
  removeSourceRecord,
  resolveRecordPriority,
  setSourceRecord,
  type MaybeEntry,
} from "./operations-records";
import {
  createResolverCacheFor,
  resolveEntryValueFor,
} from "./operations-resolve";
import {
  resolveInstanceId,
  resolveRegisterInput,
  resolveScope,
  resolveUnregisterInput,
} from "./utils";
import { validateRegistryKey } from "./schema";
import type {
  RegisterOperation,
  RegistryDefinitions,
  RegistryMetadata,
  RegistryOperation,
  RegistrySourceOrOptions,
  RegistryState,
  UnregisterOperation,
} from "./types";

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
