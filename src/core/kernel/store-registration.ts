import { isValidElement } from "react";

import { report } from "@/foundation/utils";

import { REGISTRY_VALIDATION_MODES } from "./constants";
import { createRegisterOperation, type RegistryOperations } from "./operations";
import { validateRegistryMetadata, validateRegistryValue } from "./schema";
import { createNoopHandle } from "./store-handles";
import type {
  RegisterOperation,
  RegistrationHandle,
  RegistryDefinitions,
  RegistryMetadata,
  RegistrySourceOrOptions,
} from "./types";

export function cloneRegistryValue<T>(
  value: T,
  seen = new WeakMap<object, unknown>(),
): T {
  if (value === null || typeof value !== "object" || isValidElement(value)) {
    return value;
  }

  const prototype: unknown = Object.getPrototypeOf(value);
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

function resolveRegistrationOptions(
  sourceOrOptions: RegistrySourceOrOptions | undefined,
  optionsArg?: RegistryMetadata,
): RegistryMetadata {
  if (sourceOrOptions && typeof sourceOrOptions === "object")
    return sourceOrOptions;
  return optionsArg && typeof optionsArg === "object" ? optionsArg : {};
}

export function validateRegistration(
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
