import { isObject, trimToNull } from "@/foundation/utils";

import {
  DEFAULT_REGISTRY_SCOPE,
  DEFAULT_SOURCE,
  REGISTRY_SOURCE_RANK,
} from "./constants";
import type { RegistryMetadata } from "./types/registry";

/** The trimmed string, or null for empty strings and non-strings. */
const trimmedString = (value: unknown): string | null =>
  typeof value === "string" ? value.trim() || null : null;

const sourceOf = (options: Record<string, unknown>): string =>
  typeof options.source === "string" ? options.source : DEFAULT_SOURCE;

/**
 * Safe own-property check that works on objects without a prototype.
 */
export function hasOwnProperty(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

export function parseFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getValidString(
  value: unknown,
  fallback: string | null = null,
): string | null {
  return trimToNull(value) ?? fallback;
}

export function resolveInstanceId(value: unknown): string | null {
  return isObject(value) && typeof value.instanceId === "string"
    ? value.instanceId
    : null;
}

export function getSourceRank(source: string): number {
  return REGISTRY_SOURCE_RANK[source] ?? 0;
}

export function resolveRegisterInput(
  sourceOrOptions: unknown,
  optionsArg?: unknown,
): { source: string; options: RegistryMetadata } {
  if (typeof sourceOrOptions === "string") {
    return {
      source: sourceOrOptions,
      options: isObject(optionsArg) ? optionsArg : {},
    };
  }
  if (isObject(sourceOrOptions)) {
    return { source: sourceOf(sourceOrOptions), options: sourceOrOptions };
  }
  return {
    source: DEFAULT_SOURCE,
    options: isObject(optionsArg) ? optionsArg : {},
  };
}

export function resolveScope(
  options: RegistryMetadata | null | undefined,
): string {
  return trimmedString(options?.scope) ?? DEFAULT_REGISTRY_SCOPE;
}

export function resolveUnregisterInput(sourceOrOptions: unknown): {
  instanceId: string | null;
  scope: string | null;
  source: string;
} {
  if (typeof sourceOrOptions === "string") {
    return { instanceId: null, scope: null, source: sourceOrOptions };
  }
  if (isObject(sourceOrOptions)) {
    return {
      instanceId: resolveInstanceId(sourceOrOptions),
      scope: trimmedString(sourceOrOptions.scope),
      source: sourceOf(sourceOrOptions),
    };
  }
  return { instanceId: null, scope: null, source: DEFAULT_SOURCE };
}

export function mergeModuleConfigs<T extends object>(
  base: T,
  patch: Partial<T>,
): T {
  const source = base as Record<string, unknown>;
  const changes = patch as Record<string, unknown>;
  const result: Record<string, unknown> = { ...source };
  for (const [key, patchVal] of Object.entries(changes)) {
    const baseVal = source[key];
    result[key] =
      isObject(baseVal) && isObject(patchVal)
        ? { ...baseVal, ...patchVal }
        : patchVal;
  }
  return result as T;
}
