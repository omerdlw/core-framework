"use client";

import type {
  RegistrationHandle,
  RegistryMetadata,
  RegistryTransactionQueue,
  RegistryTransactionRef,
  RegistryTransactionResult,
} from "./types";

interface QueuedOperation {
  key: string;
  options: RegistryMetadata;
  type: string;
  item?: unknown;
  unregister?: true;
}

type TransactionStatus = "open" | "committed" | "rolled-back";

export interface RegistryTransaction extends RegistryTransactionQueue {
  commit: () => RegistryTransactionResult;
  readonly operations: readonly QueuedOperation[];
  rollback: (reason?: string) => RegistryTransactionRef;
  run: (
    executor: (queue: RegistryTransactionQueue) => void,
  ) => RegistryTransactionResult;
  readonly status: TransactionStatus;
  traceId: string;
}

interface TransactionBatchQueue {
  register: (
    type: string,
    key: string,
    value: unknown,
    options?: RegistryMetadata,
  ) => RegistrationHandle;
  unregister: (type: string, key: string, options?: RegistryMetadata) => void;
}

interface TransactionStore {
  batch: (executor: (queue: TransactionBatchQueue) => void) => unknown;
}

export function createRegistryTransaction(
  store: TransactionStore,
  metadata: RegistryMetadata & { source?: string; traceId?: string } = {},
): RegistryTransaction {
  const operations: QueuedOperation[] = [];
  let status: TransactionStatus = "open";
  const traceId =
    metadata.traceId ||
    `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const ensureOpen = () => status === "open";

  const mergeOptions = (
    options: RegistryMetadata | undefined,
  ): RegistryMetadata => {
    const baseOpts = options && typeof options === "object" ? options : {};
    const needsSource = metadata.source && !baseOpts.source;
    const needsScope = metadata.scope && !baseOpts.scope;

    if (!needsSource && !needsScope) return baseOpts;

    return {
      ...baseOpts,
      ...(needsSource ? { source: metadata.source } : {}),
      ...(needsScope ? { scope: metadata.scope } : {}),
    };
  };

  const register: RegistryTransactionQueue["register"] = (
    type,
    key,
    value,
    sourceOrOptions,
    optionsArg,
  ) => {
    if (!ensureOpen()) return { index: -1, status, traceId };

    const options =
      typeof sourceOrOptions === "string"
        ? mergeOptions({ ...(optionsArg || {}), source: sourceOrOptions })
        : mergeOptions(sourceOrOptions as RegistryMetadata | undefined);

    operations.push({ key, item: value, options, type });
    return { index: operations.length - 1, status: "queued", traceId };
  };

  const unregister: RegistryTransactionQueue["unregister"] = (
    type,
    key,
    sourceOrOptions,
  ) => {
    if (!ensureOpen()) return { index: -1, status, traceId };

    const options = mergeOptions(
      typeof sourceOrOptions === "string"
        ? { source: sourceOrOptions }
        : (sourceOrOptions as RegistryMetadata | undefined),
    );

    operations.push({ key, options, type, unregister: true });
    return { index: operations.length - 1, status: "queued", traceId };
  };

  const rollback = (_reason = "manual"): RegistryTransactionRef => {
    if (!ensureOpen()) return { index: -1, status, traceId };

    status = "rolled-back";
    operations.length = 0;
    return { index: -1, status, traceId };
  };

  const commit = (): RegistryTransactionResult => {
    if (!ensureOpen()) return { status, traceId };

    status = "committed";
    const result = store.batch((queue) => {
      operations.forEach((op) => {
        if (op.unregister) queue.unregister(op.type, op.key, op.options);
        else queue.register(op.type, op.key, op.item, op.options);
      });
    });

    const applied =
      typeof result === "number" && Number.isFinite(result) ? result : 0;
    return { applied, queued: operations.length, status, traceId };
  };

  const run = (
    executor: (queue: RegistryTransactionQueue) => void,
  ): RegistryTransactionResult => {
    if (typeof executor !== "function") {
      rollback("invalid-executor");
      return { status, traceId };
    }
    try {
      executor({ register, unregister });
      return commit();
    } catch (error) {
      rollback(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  return {
    commit,
    get operations() {
      return operations.slice();
    },
    register,
    rollback,
    run,
    get status() {
      return status;
    },
    traceId,
    unregister,
  };
}
