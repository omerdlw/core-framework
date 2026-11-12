"use client";

import { usePathname } from "next/navigation";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { isObject, shallowEqual } from "@/foundation/utils";

import { applyRegistryConfig } from "./handlers";
import { createModulePayload, useInstalledModules } from "./installed";
import { useRegistryActions } from "./provider";
import { stabilizeRegistryValue } from "./stabilize";
import type {
  PageConfig,
  RegistryApplyContext,
  RegistryCleanupTimer,
  RegistryMetadata,
  RegistryQueue,
  RegistrySourceOrOptions,
  StableFunctionEntry,
} from "./types";

function withInstanceId(
  instanceId: string,
  sourceOrOptions: RegistrySourceOrOptions | undefined,
  optionsArg?: RegistryMetadata,
): {
  optionsArg: RegistryMetadata | undefined;
  sourceOrOptions: RegistrySourceOrOptions;
} {
  if (typeof sourceOrOptions === "string") {
    return {
      optionsArg: { ...(isObject(optionsArg) ? optionsArg : {}), instanceId },
      sourceOrOptions,
    };
  }
  if (isObject(sourceOrOptions)) {
    return {
      optionsArg,
      sourceOrOptions: { ...sourceOrOptions, instanceId },
    };
  }
  return {
    optionsArg: undefined,
    sourceOrOptions: {
      ...(isObject(optionsArg) ? optionsArg : {}),
      instanceId,
    },
  };
}

function withInstanceIdForUnregister(
  instanceId: string,
  sourceOrOptions: RegistrySourceOrOptions | undefined,
): RegistryMetadata {
  if (typeof sourceOrOptions === "string") {
    return { instanceId, source: sourceOrOptions };
  }
  if (isObject(sourceOrOptions)) {
    return { ...sourceOrOptions, instanceId };
  }
  return { instanceId };
}

function resolveRegisterArgsWithInstance(
  instanceId: string,
  sourceOrOptions: RegistrySourceOrOptions | undefined,
  optionsArg?: RegistryMetadata,
): [RegistrySourceOrOptions, RegistryMetadata | undefined] {
  const input = withInstanceId(instanceId, sourceOrOptions, optionsArg);
  return [input.sourceOrOptions, input.optionsArg];
}

export function useShallowStable<T extends object>(value: T): T {
  const ref = useRef(value);
  if (ref.current !== value && !shallowEqual(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}

interface AppliedConfig {
  cleanup: () => void;
  config: unknown;
  context: RegistryApplyContext;
  payload: PageConfig | null;
}

function useAppliedRegistryConfig(
  payload: PageConfig | null,
  context: RegistryApplyContext,
  componentSlices: ReadonlySet<string>,
): void {
  const functionEntriesRef = useRef(new Map<string, StableFunctionEntry>());
  const appliedRef = useRef<AppliedConfig | null>(null);

  useLayoutEffect(() => {
    const previous = appliedRef.current;
    if (
      previous &&
      previous.payload === payload &&
      previous.context === context
    ) {
      return;
    }
    const functionEntries = functionEntriesRef.current;
    const usedPaths = new Set<string>();
    const config = stabilizeRegistryValue(
      payload,
      "config",
      { componentSlices, functionEntries, usedPaths },
      previous?.config,
    );
    functionEntries.forEach((_entry, path) => {
      if (!usedPaths.has(path)) functionEntries.delete(path);
    });

    if (
      previous &&
      previous.config === config &&
      previous.context === context
    ) {
      previous.payload = payload;
      return;
    }
    previous?.cleanup();
    appliedRef.current = {
      cleanup: applyRegistryConfig(config as PageConfig | null, context),
      config,
      context,
      payload,
    };
  });

  useLayoutEffect(
    () => () => {
      appliedRef.current?.cleanup();
      appliedRef.current = null;
    },
    [],
  );
}

/** Wraps a queue so every register/unregister carries the instance id. */
function stampQueue(queue: RegistryQueue, instanceId: string): RegistryQueue {
  return {
    register: (
      type: string,
      key: string,
      item: unknown,
      sourceOrOptions?: RegistrySourceOrOptions,
      optionsArg?: RegistryMetadata,
    ) =>
      queue.register(
        type,
        key,
        item,
        ...resolveRegisterArgsWithInstance(
          instanceId,
          sourceOrOptions,
          optionsArg,
        ),
      ),
    unregister: (
      type: string,
      key: string,
      sourceOrOptions?: RegistrySourceOrOptions,
    ) =>
      queue.unregister(
        type,
        key,
        withInstanceIdForUnregister(instanceId, sourceOrOptions),
      ),
  };
}

interface ApplyContextOptions extends Pick<
  RegistryApplyContext,
  "instanceId" | "modules" | "pathname"
> {
  cleanupScope?: RegistryApplyContext["cleanupScope"];
}

/**
 * Creates the context used to apply a page config: registry actions stamped
 * with one instance id, plus the cleanup scope and installed modules.
 */
export function createRegistryApplyContext(
  actions: RegistryQueue & Pick<RegistryApplyContext, "batch">,
  {
    cleanupScope = new Map<string, RegistryCleanupTimer>(),
    instanceId,
    modules = [],
    pathname,
  }: ApplyContextOptions,
): RegistryApplyContext {
  return {
    ...stampQueue(actions, instanceId),
    batch: (executor) =>
      typeof executor === "function"
        ? actions.batch((queue) => executor(stampQueue(queue, instanceId)))
        : 0,
    cleanupScope,
    instanceId,
    modules,
    pathname,
  };
}

export function useRegistry(
  config?: PageConfig | null,
  metadata?: RegistryMetadata,
): void {
  const { batch, register, unregister } = useRegistryActions();
  const pathname = usePathname();
  const modules = useInstalledModules();
  const instanceId = `registry-instance-${useId()}`;
  const [cleanupScope] = useState(
    () => new Map<string, RegistryCleanupTimer>(),
  );

  const context = useMemo(
    () =>
      createRegistryApplyContext(
        { batch, register, unregister },
        {
          cleanupScope,
          instanceId,
          modules,
          pathname,
        },
      ),
    [batch, cleanupScope, instanceId, modules, pathname, register, unregister],
  );

  const payload = useMemo(
    () => (config ? createModulePayload(modules, config, metadata) : null),
    [config, metadata, modules],
  );
  const componentSlices = useMemo(
    () =>
      new Set(
        modules
          .filter(
            (coreModule) => coreModule.registry?.valueKind === "component",
          )
          .map((coreModule) => coreModule.id),
      ),
    [modules],
  );
  useAppliedRegistryConfig(payload, context, componentSlices);
}
