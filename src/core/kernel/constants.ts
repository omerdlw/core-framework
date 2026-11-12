import type {
  RegistryLifecycle,
  RegistryScopeKind,
  RegistrySource,
  RegistryValidationMode,
} from "./types";

/**
 * Source used when a registration does not name one.
 */
export const DEFAULT_SOURCE: RegistrySource = "dynamic";

/**
 * Built-in registry sources.
 */
export const REGISTRY_SOURCES: Readonly<Record<string, RegistrySource>> =
  Object.freeze({
    STATIC: "static",
    DYNAMIC: "dynamic",
    USER: "user",
  });

/**
 * Built-in registry lifecycles.
 */
export const REGISTRY_LIFECYCLES: Readonly<Record<string, RegistryLifecycle>> =
  Object.freeze({
    IMMEDIATE: "immediate",
    GRACEFUL: "graceful",
    PERSISTENT: "persistent",
    ROUTE: "route",
  });

/**
 * Built-in registry validation modes.
 */
export const REGISTRY_VALIDATION_MODES: Readonly<
  Record<string, RegistryValidationMode>
> = Object.freeze({
  WARN: "warn",
  STRICT: "strict",
});

/**
 * Option names recognized as registry metadata.
 */
export const REGISTRY_METADATA_KEYS: readonly string[] = Object.freeze([
  "cleanup",
  "cleanupDelayMs",
  "instanceId",
  "lifecycle",
  "priority",
  "source",
  "scope",
  "validation",
]);

/**
 * Default priority of each built-in source.
 */
export const REGISTRY_SOURCE_PRIORITY: Readonly<Record<string, number>> =
  Object.freeze({
    [REGISTRY_SOURCES.STATIC]: 100,
    [REGISTRY_SOURCES.DYNAMIC]: 200,
    [REGISTRY_SOURCES.USER]: 300,
  });

/**
 * Tie-break rank of each built-in source.
 */
export const REGISTRY_SOURCE_RANK: Readonly<Record<string, number>> =
  Object.freeze({
    [REGISTRY_SOURCES.STATIC]: 10,
    [REGISTRY_SOURCES.DYNAMIC]: 20,
    [REGISTRY_SOURCES.USER]: 30,
  });

/**
 * Set of valid lifecycle values.
 */
export const REGISTRY_LIFECYCLE_VALUES: ReadonlySet<string> = new Set(
  Object.values(REGISTRY_LIFECYCLES),
);

/**
 * Set of valid registry metadata keys.
 */
export const REGISTRY_METADATA_KEY_SET: ReadonlySet<string> = new Set(
  REGISTRY_METADATA_KEYS,
);

const REGISTRY_SCOPE_KINDS: Readonly<Record<string, RegistryScopeKind>> =
  Object.freeze({
    APP: "app",
    SESSION: "session",
    ROUTE: "route",
    INSTANCE: "instance",
    WORKSPACE: "workspace",
  });

/**
 * Scope used when a registration does not name one.
 */
export const DEFAULT_REGISTRY_SCOPE: RegistryScopeKind =
  REGISTRY_SCOPE_KINDS.APP;
