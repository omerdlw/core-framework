import type {
  RegisterOperation,
  RegistrationHandle,
  RegistryMetadata,
  RegistryStore,
} from "./types";

export function createNoopHandle(
  status: RegistrationHandle["status"] = "rejected",
  reason = "unknown",
): RegistrationHandle {
  const handle: RegistrationHandle = Object.assign(() => false, {
    active: false,
    dispose: () => false,
    instanceId: null,
    key: "",
    priority: 0,
    reason,
    source: "",
    status,
    type: "",
    update: (): RegistrationHandle => handle,
    updatedAt: 0,
    validation: "warn",
  });
  return handle;
}

const NOOP_HANDLE: RegistrationHandle = createNoopHandle();

function isNoopHandle(handle: RegistrationHandle | null | undefined): boolean {
  return (
    handle === NOOP_HANDLE ||
    handle?.status === "rejected" ||
    handle?.status === "ignored"
  );
}

export function createRegistrationHandle(
  store: RegistryStore,
  operation: RegisterOperation,
): RegistrationHandle {
  let disposed = false;
  const dispose = (reason = "manual") => {
    if (disposed) return false;
    disposed = true;
    return store.dispose(operation, reason);
  };

  const handle = ((reason?: string) => dispose(reason)) as RegistrationHandle;
  handle.dispose = dispose;

  handle.update = (value: unknown, options: RegistryMetadata = {}) => {
    if (disposed || !store.isCurrent(operation)) return NOOP_HANDLE;
    const nextHandle = store.register(
      operation.type,
      operation.key,
      value,
      operation.source,
      {
        ...(typeof options === "object" ? options : {}),
        instanceId: operation.instanceId,
        priority: operation.record.priority,
        ...(operation.scope ? { scope: operation.scope } : {}),
        ...(operation.validation ? { validation: operation.validation } : {}),
      },
    );
    if (isNoopHandle(nextHandle)) return handle;
    disposed = true;
    return nextHandle;
  };

  Object.defineProperties(handle, {
    active: {
      enumerable: true,
      get: () => !disposed && store.isCurrent(operation),
    },
    instanceId: { enumerable: true, value: operation.instanceId },
    key: { enumerable: true, value: operation.key },
    priority: { enumerable: true, value: operation.record.priority },
    source: { enumerable: true, value: operation.source },
    status: {
      enumerable: true,
      get: () =>
        disposed
          ? "disposed"
          : store.isCurrent(operation)
            ? "active"
            : "superseded",
    },
    type: { enumerable: true, value: operation.type },
    updatedAt: { enumerable: true, value: operation.record.updatedAt },
    validation: { enumerable: true, value: operation.validation || "warn" },
  });

  return handle;
}
