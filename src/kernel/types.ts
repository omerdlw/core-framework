import type { ComponentType, Context, ReactNode } from "react";
import type { ExternalStore } from "@/utils";

export type AnyFunction = (...args: unknown[]) => unknown;

export interface AppRegistryEntry<T = unknown> {
  type: string;
  items: Record<string, T>;
  instanceId?: string;
  options?: RegistryMetadata;
  source?: string;
}

export type RegistrySource = "static" | "dynamic" | "user" | (string & {});

export type RegistryLifecycle =
  "immediate" | "graceful" | "persistent" | "route";

export type RegistryValidationMode = "warn" | "strict";

export type RegistryScopeKind =
  "app" | "session" | "route" | "instance" | "workspace";

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

export interface RegistryDefinitions {
  get(type: string): RegistryDefinition | undefined;
  keys(): Iterable<string>;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  reason?: string;
}

export interface SourceRecord<T = unknown> {
  updatedAt: number;
  sequence: number;
  instanceId: string | null;
  priority: number;
  source: string;
  scope: string;
  value: T;
}

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

export interface UnregisterOperation {
  kind: "unregister";
  instanceId: string | null;
  scope: string | null;
  source: string;
  type: string;
  key: string;
}

export type RegistryOperation = RegisterOperation | UnregisterOperation;

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

export interface RegistrySchema {
  [key: string]: unknown;
}

type RegistryTypeKey = keyof RegistrySchema & string;

export interface NormalizedRegistryMetadata {
  cleanupDelayMs: number | null;
  lifecycle: RegistryLifecycle | null;
  priority: number | null;
  registerOptions: RegistryMetadata;
  scope?: string;
  source: string;
  validation?: RegistryValidationMode;
}

export type RegistryEntryRecords = Record<string, unknown>;
export type RegistryState = Record<
  string,
  Record<string, RegistryEntryRecords>
>;

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

export interface RegistryQueue {
  register: RegistryRegisterFn;
  unregister: RegistryUnregisterFn;
}

export interface RegistryCleanupTimer {
  cancelled: boolean;
  timerId: ReturnType<typeof setTimeout> | null;
}

export interface RegistryApplyContext extends RegistryQueue {
  batch: (executor: (queue: RegistryQueue) => void) => number;
  cleanupScope: Map<string, RegistryCleanupTimer>;
  instanceId: string;
  modules?: readonly AnyCoreModule[];
  pathname: string;
}

export interface RegistryTransactionResult {
  applied?: number;
  queued?: number;
  status: "open" | "committed" | "rolled-back";
  traceId: string;
}

export interface RegistryTransactionRef {
  index: number;
  status: "open" | "committed" | "rolled-back" | "queued";
  traceId: string;
}

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

export interface PageOptions {
  instanceId?: string;
  lifecycle?: RegistryLifecycle;
  priority?: number;
  scope?: string;
  source?: string;
  [key: string]: unknown;
}

export interface PageConfig {
  registry?: RegistryMetadata;
  title?: string;
}

export interface PageController {
  Provider: ({ children }: { children?: ReactNode }) => ReactNode;
  config: PageConfig;
  modules: PageModules;
  reset: () => void;
  set: (partial: Partial<PageConfig>) => void;
}

export interface RegistrationEntry {
  cleanupDelayMs: number | null;
  key: string;
  lifecycle: RegistryLifecycle | null;
  registerOptions: RegistryMetadata;
  scope: string | undefined;
  source: string;
  value: unknown;
}

export interface StableFunctionEntry {
  current: AnyFunction;
  stable: AnyFunction;
}

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

export interface CoreModules {}

export type ModuleId = keyof CoreModules & string;

export interface ModuleRuntime<TState = unknown, TActions = unknown> {
  readonly actions: TActions;
  readonly store: ExternalStore<TState>;
}

export interface PageRegistration {
  key: string;
  value: unknown;
}

export interface ModulePageContext {
  pathname: string;
}

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

export type AnyCoreModule = CoreModule<string, any, any, any>;

export type ModuleRuntimeOf<M> =
  M extends CoreModule<string, infer TRuntime, any, any> ? TRuntime : never;

export type ModuleStateOf<K extends ModuleId> =
  ModuleRuntimeOf<CoreModules[K]> extends ModuleRuntime<infer TState, unknown>
    ? TState
    : never;

type ModuleControllerOf<M> =
  M extends CoreModule<string, any, any, infer TController>
    ? TController
    : never;

export type PageModules = {
  [
    K in ModuleId as [ModuleControllerOf<CoreModules[K]>] extends [never]
      ? never
      : K
  ]?: ModuleControllerOf<CoreModules[K]>;
};
