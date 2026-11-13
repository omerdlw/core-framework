"use client";

import { usePathname } from "next/navigation";
import { useId, useLayoutEffect, useRef, useState } from "react";

import { isObject, shallowEqual } from "@/foundation/utils";

import { applyRegistryConfig } from "./handlers";
import { createModulePayload, useInstalledModules } from "./installed";
import { useRegistryActions } from "./provider";
import { stabilizeRegistryValue } from "./stabilize";
import type {
  AnyCoreModule,
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
  // Compiler exception (docs/architecture-and-rules.md): the ref keeps the
  // last shallow-equal value; writing it during render is idempotent.
  /* eslint-disable react-hooks/refs */
  if (ref.current !== value && !shallowEqual(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
  /* eslint-enable react-hooks/refs */
}

/**
 * What `useRegistry` applies. The context and payload are derived from these
 * inside the layout effect, so they stay stable without hand-written memos.
 */
interface RegistryInputs {
  actions: Pick<RegistryApplyContext, "batch"> & RegistryQueue;
  cleanupScope: Map<string, RegistryCleanupTimer>;
  config: PageConfig | null | undefined;
  instanceId: string;
  metadata: RegistryMetadata | undefined;
  modules: readonly AnyCoreModule[];
  pathname: string;
}

interface AppliedConfig {
  cleanup: () => void;
  config: unknown;
  context: RegistryApplyContext;
  inputs: RegistryInputs;
}

const NO_METADATA: RegistryMetadata = Object.freeze({});

function sameContextInputs(a: RegistryInputs, b: RegistryInputs): boolean {
  return (
    a.actions.batch === b.actions.batch &&
    a.actions.register === b.actions.register &&
    a.actions.unregister === b.actions.unregister &&
    a.cleanupScope === b.cleanupScope &&
    a.instanceId === b.instanceId &&
    a.modules === b.modules &&
    a.pathname === b.pathname
  );
}

function samePayloadInputs(a: RegistryInputs, b: RegistryInputs): boolean {
  return (
    a.config === b.config &&
    a.modules === b.modules &&
    shallowEqual(a.metadata ?? NO_METADATA, b.metadata ?? NO_METADATA)
  );
}

// The installed modules array is frozen for the host's lifetime, so the set
// is built once instead of on every render's registry pass.
const componentSlicesByModules = new WeakMap<
  readonly AnyCoreModule[],
  ReadonlySet<string>
>();

function componentSliceIds(
  modules: readonly AnyCoreModule[],
): ReadonlySet<string> {
  let ids = componentSlicesByModules.get(modules);
  if (!ids) {
    ids = new Set(
      modules
        .filter((coreModule) => coreModule.registry?.valueKind === "component")
        .map((coreModule) => coreModule.id),
    );
    componentSlicesByModules.set(modules, ids);
  }
  return ids;
}

function useAppliedRegistryConfig(inputs: RegistryInputs): void {
  const functionEntriesRef = useRef(new Map<string, StableFunctionEntry>());
  const appliedRef = useRef<AppliedConfig | null>(null);

  useLayoutEffect(() => {
    const previous = appliedRef.current;
    const sameContext =
      previous !== null && sameContextInputs(previous.inputs, inputs);
    if (previous && sameContext && samePayloadInputs(previous.inputs, inputs)) {
      return;
    }
    const context =
      previous && sameContext
        ? previous.context
        : createRegistryApplyContext(inputs.actions, inputs);
    const payload = inputs.config
      ? createModulePayload(inputs.modules, inputs.config, inputs.metadata)
      : null;
    const componentSlices = componentSliceIds(inputs.modules);
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

    if (previous && previous.config === config && sameContext) {
      previous.inputs = inputs;
      return;
    }
    previous?.cleanup();
    appliedRef.current = {
      cleanup: applyRegistryConfig(config as PageConfig | null, context),
      config,
      context,
      inputs,
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

  useAppliedRegistryConfig({
    actions: { batch, register, unregister },
    cleanupScope,
    config,
    instanceId,
    metadata,
    modules,
    pathname,
  });
}
