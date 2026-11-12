import type { ComponentType, Context, ReactNode } from "react";

import type { ExternalStore } from "@/foundation/utils";

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

type RegistryTypeKey = keyof RegistrySchema & string;

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

type RegistryRegisterFn = <
  K extends RegistryTypeKey = RegistryTypeKey,
  T = RegistrySchema[K],
>(
  type: K,
  key: string,
  item: T,
  sourceOrOptions?: RegistrySourceOrOptions,
  optionsArg?: RegistryMetadata,
) => RegistrationHandle<T>;

type RegistryUnregisterFn = <K extends RegistryTypeKey = RegistryTypeKey>(
  type: K,
  key: string,
  sourceOrOptions?: RegistrySourceOrOptions,
) => void;

/**
 * The register and unregister functions available inside a batch.
 */
export interface RegistryQueue {
  register: RegistryRegisterFn;
  unregister: RegistryUnregisterFn;
}

/**
 * A pending delayed cleanup that can be cancelled.
 */
export interface RegistryCleanupTimer {
  cancelled: boolean;
  timerId: ReturnType<typeof setTimeout> | null;
}

/**
 * Everything needed to apply a page config to the registry for one component
 * instance.
 */
export interface RegistryApplyContext extends RegistryQueue {
  batch: (executor: (queue: RegistryQueue) => void) => number;
  cleanupScope: Map<string, RegistryCleanupTimer>;
  instanceId: string;
  modules?: readonly AnyCoreModule[];
  pathname: string;
}

/**
 * Outcome of a transaction: its status and how many operations were queued and
 * applied.
 */
export interface RegistryTransactionResult {
  applied?: number;
  queued?: number;
  status: "open" | "committed" | "rolled-back";
  traceId: string;
}

/**
 * Reference to one operation queued in a transaction.
 */
export interface RegistryTransactionRef {
  index: number;
  status: "open" | "committed" | "rolled-back" | "queued";
  traceId: string;
}

/**
 * The register and unregister functions available inside a transaction.
 */
export interface RegistryTransactionQueue {
  register: (
    type: string,
    key: string,
    value: unknown,
    sourceOrOptions?: RegistrySourceOrOptions,
    optionsArg?: RegistryMetadata,
  ) => RegistryTransactionRef;
  unregister: (
    type: string,
    key: string,
    sourceOrOptions?: RegistrySourceOrOptions,
  ) => RegistryTransactionRef;
}

/**
 * The registry store: register, unregister, batch, transaction and snapshot
 * reads.
 */
export interface RegistryStore {
  batch: (executor: (queue: RegistryQueue) => void) => number;
  dispose: (operation: RegisterOperation, reason?: string) => boolean;
  getEntriesSnapshot: <
    K extends RegistryTypeKey = RegistryTypeKey,
    T = RegistrySchema[K],
  >(
    type: K,
    scope?: string | null,
  ) => Record<string, T>;
  getSnapshot: <
    K extends RegistryTypeKey = RegistryTypeKey,
    T = RegistrySchema[K],
  >(
    type: K,
    key: string,
    scope?: string | null,
  ) => T | undefined;
  isCurrent: (operation: RegisterOperation) => boolean;
  register: RegistryRegisterFn;
  subscribe: <K extends RegistryTypeKey = RegistryTypeKey>(
    type: K,
    key: string | null | undefined,
    listener: () => void,
  ) => () => void;
  transaction: (
    executor: (tx: RegistryTransactionQueue) => void,
    metadata?: RegistryMetadata,
  ) => RegistryTransactionResult;
  unregister: RegistryUnregisterFn;
}

/**
 * Options for usePage(): registry metadata applied to the whole page.
 */
export interface PageOptions {
  instanceId?: string;
  lifecycle?: RegistryLifecycle;
  priority?: number;
  scope?: string;
  source?: string;
  [key: string]: unknown;
}

/**
 * Per-page configuration: one slice per module, plus registry metadata and a
 * title.
 */
export interface PageConfig {
  registry?: RegistryMetadata;
  title?: string;
}

/**
 * A page's controller: its config, module controllers, setters and a scoped
 * provider.
 */
export interface PageController {
  Provider: ({ children }: { children?: ReactNode }) => ReactNode;
  config: PageConfig;
  modules: PageModules;
  reset: () => void;
  set: (partial: Partial<PageConfig>) => void;
}

/**
 * A single prepared registration, ready to be applied to the registry.
 */
export interface RegistrationEntry {
  cleanupDelayMs: number | null;
  key: string;
  lifecycle: RegistryLifecycle | null;
  registerOptions: RegistryMetadata;
  scope: string | undefined;
  source: string;
  value: unknown;
}

/**
 * A function and the stable wrapper that always calls its latest version.
 */
export interface StableFunctionEntry {
  current: AnyFunction;
  stable: AnyFunction;
}

/**
 * Tracks the stack of mounted pages and exposes the topmost controller.
 */
export interface PageControllerStore {
  getSnapshot: () => PageController | null;
  notify: () => void;
  register: (
    id: string,
    controllerRef: { current: PageController | null },
  ) => void;
  subscribe: (listener: () => void) => () => void;
  unregister: (id: string) => void;
}

/**
 * Maps module ids to their module types. Augment it to register your own
 * modules.
 */
export interface CoreModules {}

/**
 * The id of a registered module.
 */
export type ModuleId = keyof CoreModules & string;

/**
 * A module's runtime: its actions and its observable store.
 */
export interface ModuleRuntime<TState = unknown, TActions = unknown> {
  readonly actions: TActions;
  readonly store: ExternalStore<TState>;
}

/**
 * A key and value a module registers for a page.
 */
export interface PageRegistration {
  key: string;
  value: unknown;
}

/**
 * Context passed to a module when it turns a page slice into registrations.
 */
export interface ModulePageContext {
  pathname: string;
}

/**
 * The page API given to a module's page controller hook.
 */
export interface PageModuleApi {
  set: (partial: Partial<PageConfig>) => void;
}

type ModuleSliceItem<TSlice> = TSlice extends readonly (infer TItem)[]
  ? TItem
  : TSlice;

interface ModulePageSpec<TSlice, TController> {
  select?(config: PageConfig): TSlice | null | undefined;
  entries?(
    item: ModuleSliceItem<TSlice>,
    context: ModulePageContext,
  ): readonly PageRegistration[] | null | undefined;
  use?(slice: TSlice | null, page: PageModuleApi): TController;
}

/**
 * Definition of a module: its id, provider, overlays, registry type and page
 * integration.
 */
export interface CoreModule<
  TId extends string = string,
  TRuntime = unknown,
  TSlice = unknown,
  TController = unknown,
> {
  readonly id: TId;
  readonly context?: Context<TRuntime | null>;
  readonly Provider?: ComponentType<{ children?: ReactNode }>;
  readonly Backdrop?: ComponentType;
  readonly Overlay?: ComponentType;
  readonly uses?: readonly string[];
  readonly registry?: RegistryDefinition;
  readonly page?: ModulePageSpec<TSlice, TController>;
}

/**
 * A CoreModule with its type parameters erased.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- module type parameters are erased for any registered module
export type AnyCoreModule = CoreModule<string, any, any, any>;

/**
 * The runtime type of a module.
 */
export type ModuleRuntimeOf<M> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module type parameters are erased for inference
  M extends CoreModule<string, infer TRuntime, any, any> ? TRuntime : never;

/**
 * The state type of a registered module.
 */
export type ModuleStateOf<K extends ModuleId> =
  ModuleRuntimeOf<CoreModules[K]> extends ModuleRuntime<infer TState, unknown>
    ? TState
    : never;

type ModuleControllerOf<M> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module type parameters are erased for inference
  M extends CoreModule<string, any, any, infer TController>
    ? TController
    : never;

/**
 * Controllers contributed by modules, keyed by module id.
 */
export type PageModules = {
  [
    K in ModuleId as [ModuleControllerOf<CoreModules[K]>] extends [never]
      ? never
      : K
  ]?: ModuleControllerOf<CoreModules[K]>;
};
