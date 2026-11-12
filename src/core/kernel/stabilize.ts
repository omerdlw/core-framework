import { Children, cloneElement, isValidElement } from "react";

import type { AnyFunction, StableFunctionEntry } from "./types";

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

export interface StabilizeScope {
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

export function stabilizeRegistryValue(
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
