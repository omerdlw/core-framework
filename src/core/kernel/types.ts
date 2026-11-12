/**
 * Any function, with arguments and result erased.
 */
export type AnyFunction = (...args: unknown[]) => unknown;

/**
 * A group of registry items of one type, used to seed the registry at startup.
 */
export interface AppRegistryEntry<T = unknown> {
  type: string;
  items: Record<string, T>;
  instanceId?: string;
  options?: RegistryMetadata;
  source?: string;
}

/**
 * Where a registry entry came from. Higher-ranked sources win ties.
 */
export type RegistrySource = "static" | "dynamic" | "user" | (string & {});

/**
 * When an entry is removed: immediately, after a delay, never, or with the
 * route.
 */
export type RegistryLifecycle =
  "immediate" | "graceful" | "persistent" | "route";

/**
 * How invalid registrations are handled: warn and keep, or reject.
 */
export type RegistryValidationMode = "warn" | "strict";

/**
 * The kinds of scope a registry entry can be tied to.
 */
export type RegistryScopeKind =
  "app" | "session" | "route" | "instance" | "workspace";

/**
 * Options that control how a registry entry is stored, prioritized and cleaned
 * up.
 */
export interface RegistryMetadata {
  cleanup?: RegistryLifecycle;
  cleanupDelayMs?: number | null;
  instanceId?: string | null;
  lifecycle?: RegistryLifecycle;
  priority?: number;
  source?: string;
  scope?: string;
  validation?: RegistryValidationMode;
}

type RegistryKeyPolicy = "singleton" | "named" | "path" | "route";

/**
 * Describes one registry type: its key rules, lifecycle, value kind, merging
 * and validation.
 */
export interface RegistryDefinition<TValue = unknown> {
  keyPolicy: RegistryKeyPolicy;
  lifecycle: RegistryLifecycle;
  cleanupDelayMs?: number | null;
  singletonKey?: string;
  reservedKeys?: readonly string[];
  valueKind?: "object" | "component";
  merge?(valuesLowToHigh: TValue[]): TValue;
  validate?(value: unknown): ValidationResult;
}

/**
 * Lookup of registry definitions by type name.
 */
export interface RegistryDefinitions {
  get(type: string): RegistryDefinition | undefined;
  keys(): Iterable<string>;
}

/**
 * Outcome of a validation: whether it passed and the issues found.
 */
export interface ValidationResult {
  valid: boolean;
  issues: string[];
  reason?: string;
}

/**
 * One source's stored value for a registry key, with priority and timing.
 */
export interface SourceRecord<T = unknown> {
  updatedAt: number;
  sequence: number;
  instanceId: string | null;
  priority: number;
  source: string;
  scope: string;
  value: T;
}

/**
 * A queued request to register a value.
 */
export interface RegisterOperation<T = unknown> {
  kind: "register";
  validation?: RegistryValidationMode;
  source: string;
  scope: string;
  record: SourceRecord<T>;
  instanceId: string | null;
  type: string;
  key: string;
}

/**
 * A queued request to remove a source's value.
 */
export interface UnregisterOperation {
  kind: "unregister";
  instanceId: string | null;
  scope: string | null;
  source: string;
  type: string;
  key: string;
}

/**
 * A register or unregister operation.
 */
export type RegistryOperation = RegisterOperation | UnregisterOperation;

/**
 * Callable handle returned by register(); call it to unregister, or use
 * update() to replace the value.
 */
export interface RegistrationHandle<T = unknown> {
  (reason?: string): boolean;
  active: boolean;
  dispose: (reason?: string) => boolean;
  instanceId: string | null;
  key: string;
  priority: number;
  reason?: string;
  source: string;
  status: "active" | "disposed" | "superseded" | "rejected" | "ignored";
  type: string;
  update: (value: T, options?: RegistryMetadata) => RegistrationHandle<T>;
  updatedAt: number;
  validation: string;
}

/**
 * Maps registry type names to their value types. Augment it to type your own
 * registry types.
 */
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style -- module augmentation point; a type alias cannot be merged
export interface RegistrySchema {
  [key: string]: unknown;
}

/**
 * Registry metadata after defaults and validation have been applied.
 */
export interface NormalizedRegistryMetadata {
  cleanupDelayMs: number | null;
  lifecycle: RegistryLifecycle | null;
  priority: number | null;
  registerOptions: RegistryMetadata;
  scope?: string;
  source: string;
  validation?: RegistryValidationMode;
}

/**
 * All source records stored under one registry key.
 */
export type RegistryEntryRecords = Record<string, unknown>;

/**
 * The full registry state: records per key, per type.
 */
export type RegistryState = Record<
  string,
  Record<string, RegistryEntryRecords>
>;

/**
 * A source name, or a metadata object that includes one.
 */
export type RegistrySourceOrOptions = string | RegistryMetadata;

export type {
  RegistryQueue,
  RegistryCleanupTimer,
  RegistryApplyContext,
  RegistryTransactionResult,
  RegistryTransactionRef,
  RegistryTransactionQueue,
  RegistryStore,
} from "./types-store";
export type {
  PageOptions,
  PageConfig,
  PageController,
  RegistrationEntry,
  StableFunctionEntry,
  PageControllerStore,
} from "./types-page";
export type {
  CoreModules,
  ModuleId,
  ModuleRuntime,
  PageRegistration,
  ModulePageContext,
  PageModuleApi,
  CoreModule,
  AnyCoreModule,
  ModuleRuntimeOf,
  ModuleStateOf,
  PageModules,
} from "./types-modules";
