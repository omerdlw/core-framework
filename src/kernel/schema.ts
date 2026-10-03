import {
  DEFAULT_SOURCE,
  REGISTRY_LIFECYCLE_VALUES,
  REGISTRY_LIFECYCLES,
  REGISTRY_METADATA_KEY_SET,
  REGISTRY_METADATA_KEYS,
  REGISTRY_VALIDATION_MODES,
} from "./constants";
import { isObject, isPlainObject } from "@/utils";
import { getValidString, parseFiniteNumber } from "./utils";
import type {
  NormalizedRegistryMetadata,
  RegistryDefinitions,
  RegistryLifecycle,
  RegistryMetadata,
  RegistryValidationMode,
  ValidationResult,
} from "./types";

function resolveLifecycle(
  metadata: RegistryMetadata | null | undefined,
  fallback: RegistryLifecycle | null,
): RegistryLifecycle | null {
  const lifecycle = metadata?.lifecycle ?? metadata?.cleanup;
  return lifecycle && REGISTRY_LIFECYCLE_VALUES.has(lifecycle)
    ? lifecycle
    : fallback;
}

export function validateRegistryMetadata(metadata: unknown): ValidationResult {
  if (metadata === undefined || metadata === null)
    return { issues: [], valid: true };
  if (!isObject(metadata))
    return { issues: ["registry metadata must be an object"], valid: false };

  const issues: string[] = [];

  Object.keys(metadata).forEach((key) => {
    if (!REGISTRY_METADATA_KEY_SET.has(key))
      issues.push(`unknown registry metadata field: ${key}`);
  });

  if (metadata.source !== undefined && !getValidString(metadata.source))
    issues.push("source must be a non-empty string");
  if (metadata.instanceId !== undefined && !getValidString(metadata.instanceId))
    issues.push("instanceId must be a non-empty string");
  if (metadata.scope !== undefined && !getValidString(metadata.scope))
    issues.push("scope must be a non-empty string");
  if (
    metadata.priority !== undefined &&
    parseFiniteNumber(metadata.priority) === null
  )
    issues.push("priority must be a finite number");

  if (metadata.cleanupDelayMs !== undefined) {
    const delay = parseFiniteNumber(metadata.cleanupDelayMs);
    if (delay === null || delay < 0)
      issues.push("cleanupDelayMs must be a non-negative finite number");
  }

  const lifecycle = metadata.lifecycle ?? metadata.cleanup;
  if (
    lifecycle !== undefined &&
    !REGISTRY_LIFECYCLE_VALUES.has(String(lifecycle))
  ) {
    issues.push(
      `lifecycle must be one of: ${[...REGISTRY_LIFECYCLE_VALUES].join(", ")}`,
    );
  }

  if (
    metadata.validation !== undefined &&
    !Object.values<unknown>(REGISTRY_VALIDATION_MODES).includes(
      metadata.validation,
    )
  ) {
    issues.push(
      `validation must be one of: ${Object.values(REGISTRY_VALIDATION_MODES).join(", ")}`,
    );
  }

  return { issues, valid: issues.length === 0 };
}

export function validateRegistryKey(
  type: string,
  key: unknown,
  definitions: RegistryDefinitions,
): ValidationResult {
  const definition = definitions.get(type);
  const issues: string[] = [];

  if (!definition) issues.push(`unknown registry type: ${String(type)}`);
  if (!getValidString(key))
    return {
      issues: [...issues, "key must be a non-empty string"],
      valid: false,
    };

  const normalizedKey = String(key).trim();

  if (definition?.keyPolicy === "singleton") {
    const expectedKey = definition.singletonKey;
    if (expectedKey && normalizedKey !== expectedKey)
      issues.push(`${type} key must be ${expectedKey}`);
  } else if (definition?.keyPolicy === "path") {
    if (!normalizedKey.startsWith("/"))
      issues.push(`${type} key must be an absolute path`);
  } else if (definition?.keyPolicy === "route") {
    if (
      !normalizedKey.startsWith("/") &&
      !definition.reservedKeys?.includes(normalizedKey)
    ) {
      issues.push(`${type} key must be a route path or a reserved route key`);
    }
  }

  return { issues, valid: issues.length === 0 };
}

export function validateRegistryValue(
  type: string,
  key: unknown,
  value: unknown,
  definitions: RegistryDefinitions,
): ValidationResult {
  const definition = definitions.get(type);
  const issues = [...validateRegistryKey(type, key, definitions).issues];
  const valueKind = definition?.valueKind ?? "object";

  if (definition && valueKind === "object" && !isPlainObject(value)) {
    issues.push(`${type} values must be plain objects`);
  }
  if (
    definition &&
    valueKind === "component" &&
    typeof value !== "function" &&
    !isPlainObject(value)
  ) {
    issues.push(
      `${type} values must be component functions or component objects`,
    );
  }

  const validation = definition?.validate?.(value);
  if (validation && !validation.valid && Array.isArray(validation.issues)) {
    issues.push(...validation.issues);
  }

  return { issues, valid: issues.length === 0 };
}

export function normalizeRegistryMetadata(
  metadata: unknown,
  {
    defaultCleanupDelayMs = null,
    defaultLifecycle = null,
    defaultSource = DEFAULT_SOURCE,
  }: {
    defaultCleanupDelayMs?: number | null;
    defaultLifecycle?: RegistryLifecycle | null;
    defaultSource?: string;
  } = {},
): NormalizedRegistryMetadata {
  const registryMeta = isObject(metadata) ? metadata : {};

  const normalizedDefaultDelay = parseFiniteNumber(defaultCleanupDelayMs);
  const fallbackCleanupDelayMs =
    normalizedDefaultDelay !== null && normalizedDefaultDelay >= 0
      ? normalizedDefaultDelay
      : null;
  const fallbackLifecycle =
    defaultLifecycle && REGISTRY_LIFECYCLE_VALUES.has(defaultLifecycle)
      ? defaultLifecycle
      : null;

  const source =
    getValidString(registryMeta.source) ||
    getValidString(defaultSource, DEFAULT_SOURCE) ||
    DEFAULT_SOURCE;
  const scope = getValidString(registryMeta.scope);
  const priority = parseFiniteNumber(registryMeta.priority);
  const lifecycle = resolveLifecycle(registryMeta, fallbackLifecycle);
  const validation = isValidationMode(registryMeta.validation)
    ? registryMeta.validation
    : null;

  const cleanupDelayCandidate = parseFiniteNumber(registryMeta.cleanupDelayMs);
  let cleanupDelayMs =
    cleanupDelayCandidate !== null && cleanupDelayCandidate >= 0
      ? cleanupDelayCandidate
      : fallbackCleanupDelayMs;

  if (lifecycle === REGISTRY_LIFECYCLES.IMMEDIATE) {
    cleanupDelayMs = 0;
  } else if (
    (lifecycle === REGISTRY_LIFECYCLES.GRACEFUL ||
      lifecycle === REGISTRY_LIFECYCLES.ROUTE) &&
    cleanupDelayMs === null
  ) {
    cleanupDelayMs = fallbackCleanupDelayMs;
  }

  return {
    cleanupDelayMs,
    lifecycle,
    priority,
    registerOptions: {
      ...(priority !== null && { priority }),
      ...(validation === REGISTRY_VALIDATION_MODES.STRICT && { validation }),
      ...(scope && { scope }),
    },
    source,
    ...(scope && { scope }),
    ...(validation && { validation }),
  };
}

function isValidationMode(value: unknown): value is RegistryValidationMode {
  return Object.values<unknown>(REGISTRY_VALIDATION_MODES).includes(value);
}

export function pickRegistryMetadata(options: unknown): RegistryMetadata {
  if (!isObject(options)) return {};
  return Object.fromEntries(
    REGISTRY_METADATA_KEYS.filter((key) => options[key] !== undefined).map(
      (key) => [key, options[key]],
    ),
  );
}
