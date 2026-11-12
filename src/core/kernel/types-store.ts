import type {
  RegisterOperation,
  RegistrationHandle,
  RegistryMetadata,
  RegistrySchema,
  RegistrySourceOrOptions,
} from "./types";
import type { AnyCoreModule } from "./types-modules";

export type RegistryTypeKey = keyof RegistrySchema & string;

export type RegistryRegisterFn = <
  K extends RegistryTypeKey = RegistryTypeKey,
  T = RegistrySchema[K],
>(
  type: K,
  key: string,
  item: T,
  sourceOrOptions?: RegistrySourceOrOptions,
  optionsArg?: RegistryMetadata,
) => RegistrationHandle<T>;

export type RegistryUnregisterFn = <
  K extends RegistryTypeKey = RegistryTypeKey,
>(
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
