import { DEFAULT_SOURCE, REGISTRY_LIFECYCLES } from "./constants";
import {
  normalizeRegistryMetadata,
  validateRegistryMetadata,
} from "./schema";
import { isObject, report } from "@/utils";
import type {
  AnyCoreModule,
  PageConfig,
  RegistrationEntry,
  RegistryApplyContext,
  RegistryCleanupTimer,
  RegistryMetadata,
  RegistryQueue,
} from "./types";

type CleanupScope = Map<string, RegistryCleanupTimer>;

function isPersistentLifecycle(lifecycle: unknown): boolean {
  return lifecycle === REGISTRY_LIFECYCLES.PERSISTENT;
}

function runRegistrationBatch(
  context: RegistryApplyContext,
  executor: (queue: RegistryQueue) => void,
): number | void {
  return typeof context.batch === "function"
    ? context.batch(executor)
    : executor(context);
}

function createEntryCleanupKey(
  type: string,
  key: string,
  source: string,
  instanceId: string | null,
  scope: string | undefined,
): string {
  return JSON.stringify([
    "entry",
    type,
    key,
    scope ?? null,
    source,
    instanceId,
  ]);
}

function getCleanupScope(
  context: RegistryApplyContext | null | undefined,
): CleanupScope {
  return context?.cleanupScope || new Map();
}

function clearCleanupTimer(scope: CleanupScope, cleanupKey: string): void {
  const lifecycle = scope.get(cleanupKey);
  if (!lifecycle) return;
  lifecycle.cancelled = true;
  if (lifecycle.timerId !== null) clearTimeout(lifecycle.timerId);
  scope.delete(cleanupKey);
}

function scheduleCleanup(
  scope: CleanupScope,
  cleanupKey: string,
  callback: () => void,
  delayMs: number,
): void {
  clearCleanupTimer(scope, cleanupKey);
  const lifecycle: RegistryCleanupTimer = {
    cancelled: false,
    timerId: null,
  };

  lifecycle.timerId = setTimeout(() => {
    if (lifecycle.cancelled || scope.get(cleanupKey) !== lifecycle) return;
    scope.delete(cleanupKey);
    callback();
  }, delayMs);

  scope.set(cleanupKey, lifecycle);
}

type ModuleRegistration = RegistrationEntry & {
  cleanupKey: string;
  type: string;
};

function collectModuleRegistrations(
  coreModule: AnyCoreModule,
  slice: unknown,
  pageMetadata: RegistryMetadata,
  context: RegistryApplyContext,
): ModuleRegistration[] {
  const definition = coreModule.registry;
  const toEntries = coreModule.page?.entries;
  if (!definition || !toEntries || slice == null || slice === false) return [];

  const type = coreModule.id;
  const items = Array.isArray(slice) ? slice : [slice];
  const registrations: ModuleRegistration[] = [];

  for (const item of items) {
    if (item == null || item === false) continue;
    const itemMetadata =
      isObject(item) && isObject(item.registry) ? item.registry : {};
    const metadata = { ...pageMetadata, ...itemMetadata };
    if (
      metadata.validation === "strict" &&
      !validateRegistryMetadata(metadata).valid
    ) {
      continue;
    }

    const payload = isObject(item)
      ? Object.fromEntries(
          Object.entries(item).filter(([key]) => key !== "registry"),
        )
      : item;
    const { cleanupDelayMs, lifecycle, registerOptions, scope, source } =
      normalizeRegistryMetadata(metadata, {
        defaultCleanupDelayMs: definition.cleanupDelayMs ?? null,
        defaultLifecycle: definition.lifecycle,
        defaultSource: DEFAULT_SOURCE,
      });

    for (const { key, value } of toEntries(payload, context) ?? []) {
      const validation = definition.validate?.(value);
      if (validation && !validation.valid) {
        report(`Registry ${type} config is invalid`, validation.issues, "warn");
        continue;
      }
      registrations.push({
        cleanupDelayMs,
        cleanupKey: createEntryCleanupKey(
          type,
          key,
          source,
          context.instanceId,
          scope,
        ),
        key,
        lifecycle,
        registerOptions,
        scope,
        source,
        type,
        value,
      });
    }
  }
  return registrations;
}

const NO_CLEANUP = () => {};

export function applyRegistryConfig(
  config: PageConfig | null | undefined,
  context: RegistryApplyContext,
): () => void {
  const modules = context.modules ?? [];
  if (!config || modules.length === 0) return NO_CLEANUP;
  const pageMetadata = isObject(config.registry) ? config.registry : {};
  const slices = config as Record<string, unknown>;

  const registrations = modules.flatMap((coreModule) => {
    try {
      return collectModuleRegistrations(
        coreModule,
        slices[coreModule.id],
        pageMetadata,
        context,
      );
    } catch (error) {
      report(`Registry apply (${coreModule.id})`, error);
      return [];
    }
  });
  if (registrations.length === 0) return NO_CLEANUP;

  const cleanupScope = getCleanupScope(context);
  const owner = (registration: ModuleRegistration) => ({
    instanceId: context.instanceId,
    scope: registration.scope,
    source: registration.source,
  });

  runRegistrationBatch(context, (queue) => {
    registrations.forEach(
      ({ cleanupKey, key, registerOptions, source, type, value }) => {
        clearCleanupTimer(cleanupScope, cleanupKey);
        queue.register(type, key, value, source, registerOptions);
      },
    );
  });

  return () => {
    const immediate: ModuleRegistration[] = [];
    registrations.forEach((registration) => {
      if (isPersistentLifecycle(registration.lifecycle)) return;
      const { cleanupDelayMs, cleanupKey, key, type } = registration;
      if (typeof cleanupDelayMs === "number" && cleanupDelayMs > 0) {
        scheduleCleanup(
          cleanupScope,
          cleanupKey,
          () => context.unregister(type, key, owner(registration)),
          cleanupDelayMs,
        );
      } else {
        immediate.push(registration);
      }
    });
    if (immediate.length === 0) return;
    runRegistrationBatch(context, (queue) => {
      immediate.forEach((registration) =>
        queue.unregister(
          registration.type,
          registration.key,
          owner(registration),
        ),
      );
    });
  };
}
