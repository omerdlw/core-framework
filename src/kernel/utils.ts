import {
  DEFAULT_REGISTRY_SCOPE,
  DEFAULT_SOURCE,
  REGISTRY_SOURCE_RANK,
} from "./constants";
import type { RegistryMetadata } from "./types";
import { isObject, trimToNull } from "@/utils";

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
    return {
      source:
        typeof sourceOrOptions.source === "string"
          ? sourceOrOptions.source
          : DEFAULT_SOURCE,
      options: sourceOrOptions,
    };
  }
  return {
    source: DEFAULT_SOURCE,
    options: isObject(optionsArg) ? optionsArg : {},
  };
}

export function resolveScope(
  options: RegistryMetadata | null | undefined,
): string {
  return typeof options?.scope === "string" && options.scope.trim()
    ? options.scope.trim()
    : DEFAULT_REGISTRY_SCOPE;
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
      scope:
        typeof sourceOrOptions.scope === "string" &&
        sourceOrOptions.scope.trim()
          ? sourceOrOptions.scope.trim()
          : null,
      source:
        typeof sourceOrOptions.source === "string"
          ? sourceOrOptions.source
          : DEFAULT_SOURCE,
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
  Object.keys(changes).forEach((key) => {
    const baseVal = source[key];
    const patchVal = changes[key];
    if (
      baseVal &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal) &&
      patchVal &&
      typeof patchVal === "object" &&
      !Array.isArray(patchVal)
    ) {
      result[key] = { ...baseVal, ...patchVal };
    } else {
      result[key] = patchVal;
    }
  });
  return result as T;
}
