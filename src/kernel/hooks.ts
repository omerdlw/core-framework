"use client";

import { usePathname } from "next/navigation";
import { useIsomorphicLayoutEffect } from "@/hooks";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { applyRegistryConfig } from "./handlers";
import { createModulePayload, useInstalledModules } from "./installed";
import { useRegistryActions } from "./provider";
import { isObject, shallowEqual } from "@/utils";
import type {
  PageConfig,
  RegistryCleanupTimer,
  RegistryApplyContext,
  RegistryMetadata,
  RegistryQueue,
  RegistrySourceOrOptions,
  StableFunctionEntry,
  AnyFunction,
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

/* eslint-disable react-hooks/refs */
export function useShallowStable<T extends object>(value: T): T {
  const ref = useRef(value);
  if (ref.current !== value && !shallowEqual(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}
/* eslint-enable react-hooks/refs */

const MAX_STABILIZATION_DEPTH = 64;

function createStableFunctionEntry(fn: AnyFunction): StableFunctionEntry {
  const entry: StableFunctionEntry = {
    current: fn,
    stable(this: unknown, ...args: unknown[]) {
      return entry.current?.apply(this, args);
    },
  };
  return entry;
}

interface StabilizeScope {
  componentSlices: ReadonlySet<string>;
  functionEntries: Map<string, StableFunctionEntry>;
  usedPaths: Set<string>;
}

function isDirectRegistryComponentPath(
  path: string,
  componentSlices: ReadonlySet<string>,
): boolean {
  const match = /^config\.([^.[]+)\.[^.[]+$/.exec(path);
  return Boolean(match && componentSlices.has(match[1]));
}

function isReactNodeLike(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "number" ||
    isValidElement(value)
  );
}

function isStabilizableObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !isValidElement(value)
  );
}

function hasSameObjectKeys(
  previousValue: unknown,
  nextValue: unknown,
): boolean {
  if (
    !isStabilizableObject(previousValue) ||
    !isStabilizableObject(nextValue)
  ) {
    return false;
  }
  const previousKeys = Object.keys(previousValue);
  const nextKeys = Object.keys(nextValue);
  if (previousKeys.length !== nextKeys.length) return false;
  return nextKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(previousValue, key),
  );
}

function stabilizeRegistryValue(
  value: unknown,
  path: string,
  scope: StabilizeScope,
  previousValue?: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown {
  if (depth > MAX_STABILIZATION_DEPTH) return value;

  if (typeof value === "function") {
    const isComponent = value.name && /^[A-Z]/.test(value.name);
    if (
      isComponent ||
      isDirectRegistryComponentPath(path, scope.componentSlices)
    ) {
      return value;
    }
    scope.usedPaths.add(path);
    let entry = scope.functionEntries.get(path);
    if (!entry) {
      entry = createStableFunctionEntry(value as AnyFunction);
      scope.functionEntries.set(path, entry);
    } else {
      entry.current = value as AnyFunction;
    }
    return entry.stable;
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) return value;
    seen.add(value);
  }

  if (isValidElement(value)) {
    const nextProps = stabilizeRegistryValue(
      value.props,
      `${path}.props`,
      scope,
      isValidElement(previousValue) ? previousValue.props : undefined,
      seen,
      depth + 1,
    ) as Record<string, unknown>;
    if (
      isValidElement(previousValue) &&
      previousValue.type === value.type &&
      previousValue.key === value.key &&
      previousValue.props === nextProps
    ) {
      return previousValue;
    }
    return cloneElement(value, nextProps);
  }

  if (Array.isArray(value)) {
    const nextValue = value.every(isReactNodeLike)
      ? Children.toArray(value)
      : value;
    const previousArray = Array.isArray(previousValue) ? previousValue : null;
    let hasChanged =
      !previousArray || previousArray.length !== nextValue.length;

    const stabilizedValue: unknown[] = nextValue.map((item, index) => {
      const nextItem = stabilizeRegistryValue(
        item,
        `${path}[${index}]`,
        scope,
        previousArray?.[index],
        seen,
        depth + 1,
      );
      if (!previousArray || nextItem !== previousArray[index]) {
        hasChanged = true;
      }
      return nextItem;
    });
    return !hasChanged ? previousArray : stabilizedValue;
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const source = value as Record<string, unknown>;
  const previousRecord = previousValue as Record<string, unknown> | undefined;
  const stabilizedValue: Record<string, unknown> = {};
  const canReusePrevious = hasSameObjectKeys(previousValue, value);
  let hasChanged = !canReusePrevious;

  Object.keys(source).forEach((key) => {
    const nextValue = stabilizeRegistryValue(
      source[key],
      `${path}.${key}`,
      scope,
      previousRecord?.[key],
      seen,
      depth + 1,
    );
    stabilizedValue[key] = nextValue;
    if (!canReusePrevious || nextValue !== previousRecord?.[key]) {
      hasChanged = true;
    }
  });

  return !hasChanged ? previousValue : stabilizedValue;
}

function useAppliedRegistryConfig(
  payload: PageConfig | null,
  context: RegistryApplyContext,
  componentSlices: ReadonlySet<string>,
): void {
  const functionEntriesRef = useRef(new Map<string, StableFunctionEntry>());
  const appliedRef = useRef<{
    cleanup: () => void;
    config: unknown;
    context: RegistryApplyContext;
    payload: PageConfig | null;
  } | null>(null);

  useIsomorphicLayoutEffect(() => {
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

  useIsomorphicLayoutEffect(
    () => () => {
      appliedRef.current?.cleanup();
      appliedRef.current = null;
    },
    [],
  );
}

export function createRegistryApplyContext(
  actions: RegistryQueue & Pick<RegistryApplyContext, "batch">,
  {
    cleanupScope = new Map<string, RegistryCleanupTimer>(),
    instanceId,
    modules = [],
    pathname,
  }: Pick<RegistryApplyContext, "instanceId" | "modules" | "pathname"> & {
    cleanupScope?: RegistryApplyContext["cleanupScope"];
  },
): RegistryApplyContext {
  const stamp = (queue: RegistryQueue): RegistryQueue =>
    ({
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
    }) as RegistryQueue;

  return {
    ...stamp(actions),
    batch: (executor) =>
      typeof executor === "function"
        ? actions.batch((queue) => executor(stamp(queue)))
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
