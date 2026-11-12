import { isObject, report } from "@/foundation/utils";

import {
  DEFAULT_SOURCE,
  REGISTRY_LIFECYCLES,
  REGISTRY_VALIDATION_MODES,
} from "./constants";
import { normalizeRegistryMetadata, validateRegistryMetadata } from "./schema";
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
  return context?.cleanupScope || (new Map() as CleanupScope);
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

/** Item-level `registry` metadata, merged over the page-level metadata. */
function resolveItemMetadata(
  item: unknown,
  pageMetadata: RegistryMetadata,
): RegistryMetadata {
  const itemMetadata =
    isObject(item) && isObject(item.registry) ? item.registry : {};
  return { ...pageMetadata, ...itemMetadata };
}

/** The item without its `registry` metadata key, as the module sees it. */
function stripRegistryKey(item: unknown): unknown {
  if (!isObject(item)) return item;
  return Object.fromEntries(
    Object.entries(item).filter(([key]) => key !== "registry"),
  );
}

function collectModuleRegistrations(
  coreModule: AnyCoreModule,
  slice: unknown,
  pageMetadata: RegistryMetadata,
  context: RegistryApplyContext,
): ModuleRegistration[] {
  const definition = coreModule.registry;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- page.entries is called unbound as toEntries(payload, context); the module contract is a plain function that must not rely on this (pre-existing unbound call)
  const toEntries = coreModule.page?.entries;
  if (!definition || !toEntries || slice == null || slice === false) return [];

  const type = coreModule.id;
  const items = Array.isArray(slice) ? slice : [slice];
  const registrations: ModuleRegistration[] = [];

  for (const item of items) {
    if (item == null || item === false) continue;
    const metadata = resolveItemMetadata(item, pageMetadata);
    if (
      metadata.validation === REGISTRY_VALIDATION_MODES.STRICT &&
      !validateRegistryMetadata(metadata).valid
    ) {
      continue;
    }

    const payload = stripRegistryKey(item);
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

function collectRegistrations(
  modules: readonly AnyCoreModule[],
  config: PageConfig,
  context: RegistryApplyContext,
): ModuleRegistration[] {
  const pageMetadata = isObject(config.registry) ? config.registry : {};
  const slices = config as Record<string, unknown>;

  return modules.flatMap((coreModule) => {
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
}

function hasCleanupDelay(delayMs: number | null): delayMs is number {
  return typeof delayMs === "number" && delayMs > 0;
}

/**
 * Builds the teardown for applied registrations: delayed ones are scheduled,
 * the rest are unregistered together in one batch.
 */
function createTeardown(
  registrations: ModuleRegistration[],
  context: RegistryApplyContext,
  cleanupScope: CleanupScope,
): () => void {
  const owner = (registration: ModuleRegistration) => ({
    instanceId: context.instanceId,
    scope: registration.scope,
    source: registration.source,
  });

  return () => {
    const immediate: ModuleRegistration[] = [];
    registrations.forEach((registration) => {
      if (isPersistentLifecycle(registration.lifecycle)) return;
      const { cleanupDelayMs, cleanupKey, key, type } = registration;
      if (hasCleanupDelay(cleanupDelayMs)) {
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

const NO_CLEANUP = () => {};

/**
 * Registers a page config's module slices into the registry and returns a
 * function that tears them down according to each entry's lifecycle.
 */
export function applyRegistryConfig(
  config: PageConfig | null | undefined,
  context: RegistryApplyContext,
): () => void {
  const modules = context.modules ?? [];
  if (!config || modules.length === 0) return NO_CLEANUP;

  const registrations = collectRegistrations(modules, config, context);
  if (registrations.length === 0) return NO_CLEANUP;

  const cleanupScope = getCleanupScope(context);

  runRegistrationBatch(context, (queue) => {
    registrations.forEach(
      ({ cleanupKey, key, registerOptions, source, type, value }) => {
        clearCleanupTimer(cleanupScope, cleanupKey);
        queue.register(type, key, value, source, registerOptions);
      },
    );
  });

  return createTeardown(registrations, context, cleanupScope);
}
