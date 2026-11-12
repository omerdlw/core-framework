import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

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

interface StabilizeState {
  depth: number;
  scope: StabilizeScope;
  seen: WeakSet<object>;
}

function stabilizeFunction(
  fn: AnyFunction,
  path: string,
  scope: StabilizeScope,
): unknown {
  const isComponent = fn.name && /^[A-Z]/.test(fn.name);
  if (
    isComponent ||
    isDirectRegistryComponentPath(path, scope.componentSlices)
  ) {
    return fn;
  }
  scope.usedPaths.add(path);
  let entry = scope.functionEntries.get(path);
  if (!entry) {
    entry = createStableFunctionEntry(fn);
    scope.functionEntries.set(path, entry);
  } else {
    entry.current = fn;
  }
  return entry.stable;
}

function stabilizeElement(
  element: ReactElement<Record<string, unknown>>,
  path: string,
  previousValue: unknown,
  state: StabilizeState,
): unknown {
  const nextProps = stabilizeNested(
    element.props,
    `${path}.props`,
    isValidElement(previousValue) ? previousValue.props : undefined,
    state,
  ) as Record<string, unknown>;
  if (
    isValidElement(previousValue) &&
    previousValue.type === element.type &&
    previousValue.key === element.key &&
    previousValue.props === nextProps
  ) {
    return previousValue;
  }
  return cloneElement(element, nextProps);
}

function stabilizeArray(
  array: unknown[],
  path: string,
  previousValue: unknown,
  state: StabilizeState,
): unknown {
  const nextValue = array.every(isReactNodeLike)
    ? Children.toArray(array as ReactNode[]) // every item passed isReactNodeLike
    : array;
  const previousArray = Array.isArray(previousValue) ? previousValue : null;
  let hasChanged = !previousArray || previousArray.length !== nextValue.length;

  const stabilizedValue: unknown[] = nextValue.map((item, index) => {
    const nextItem = stabilizeNested(
      item,
      `${path}[${index}]`,
      previousArray?.[index],
      state,
    );
    if (!previousArray || nextItem !== previousArray[index]) {
      hasChanged = true;
    }
    return nextItem;
  });
  return !hasChanged ? previousArray : stabilizedValue;
}

function stabilizeObject(
  source: Record<string, unknown>,
  path: string,
  previousValue: unknown,
  state: StabilizeState,
): unknown {
  const previousRecord = previousValue as Record<string, unknown> | undefined;
  const stabilizedValue: Record<string, unknown> = {};
  const canReusePrevious = hasSameObjectKeys(previousValue, source);
  let hasChanged = !canReusePrevious;

  Object.keys(source).forEach((key) => {
    const nextValue = stabilizeNested(
      source[key],
      `${path}.${key}`,
      previousRecord?.[key],
      state,
    );
    stabilizedValue[key] = nextValue;
    if (!canReusePrevious || nextValue !== previousRecord?.[key]) {
      hasChanged = true;
    }
  });

  return !hasChanged ? previousValue : stabilizedValue;
}

function stabilizeNested(
  value: unknown,
  path: string,
  previousValue: unknown,
  state: StabilizeState,
): unknown {
  return stabilize(value, path, previousValue, {
    ...state,
    depth: state.depth + 1,
  });
}

function stabilize(
  value: unknown,
  path: string,
  previousValue: unknown,
  state: StabilizeState,
): unknown {
  if (state.depth > MAX_STABILIZATION_DEPTH) return value;

  if (typeof value === "function") {
    return stabilizeFunction(value as AnyFunction, path, state.scope);
  }

  if (value && typeof value === "object") {
    if (state.seen.has(value)) return value;
    state.seen.add(value);
  }

  if (isValidElement<Record<string, unknown>>(value)) {
    return stabilizeElement(value, path, previousValue, state);
  }
  if (Array.isArray(value)) {
    return stabilizeArray(value, path, previousValue, state);
  }
  if (typeof value !== "object" || value === null) return value;

  return stabilizeObject(
    value as Record<string, unknown>,
    path,
    previousValue,
    state,
  );
}

/**
 * Replaces function values with stable wrappers and reuses unchanged objects
 * from `previousValue`, so a config can be compared by reference across
 * renders.
 */
export function stabilizeRegistryValue(
  value: unknown,
  path: string,
  scope: StabilizeScope,
  previousValue?: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown {
  return stabilize(value, path, previousValue, { depth, scope, seen });
}
