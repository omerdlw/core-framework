import { isValidElement, type ReactNode } from "react";

import {
  isObject,
  shallowEqual as areShallowCollectionsEqual,
  toArray,
} from "@/foundation/utils";

import {
  DEFAULT_HUD_ID,
  DOCK_HUD_PRIORITY,
  DOCK_HUD_RENDER_MODE,
  DOCK_OPERATION_STATUS,
} from "../constants";
import type { DockComponent, DockHudDescriptor, DockOperation } from "../types";
import {
  isHudDescriptor,
  resolveComponentType,
  resolveRenderableContent,
} from "../utils";

export type DockHudEntries = Record<string, DockHudDescriptor>;

function normalizePriority(value: unknown): number {
  const priority = Number(value);
  return Number.isFinite(priority) ? priority : DOCK_HUD_PRIORITY.DEFAULT;
}

function normalizeAutoDismiss(value: unknown): number | null {
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function arePropsEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!isObject(left) || !isObject(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => {
    if (!Object.hasOwn(right, key)) return false;
    if (Object.is(left[key], right[key])) return true;
    if (typeof left[key] === "function" && typeof right[key] === "function") {
      return true;
    }
    return (
      isObject(left[key]) &&
      isObject(right[key]) &&
      areShallowCollectionsEqual(left[key], right[key])
    );
  });
}

export function areHudDefinitionsEqual(
  current: DockHudDescriptor | null | undefined,
  next: DockHudDescriptor | null | undefined,
): boolean {
  if (Object.is(current, next)) return true;
  if (
    !current ||
    !next ||
    Object.keys(current).length !== Object.keys(next).length
  ) {
    return false;
  }
  // Both HUD states are compared field by field through one string index.
  const currentFields = current as unknown as Record<string, unknown>;
  const nextFields = next as unknown as Record<string, unknown>;
  return Object.keys(nextFields).every((key) => {
    if (Object.is(currentFields[key], nextFields[key])) return true;
    if (key === "props") {
      return arePropsEqual(currentFields[key], nextFields[key]);
    }
    return (
      typeof currentFields[key] === "function" &&
      typeof nextFields[key] === "function"
    );
  });
}

export function upsertHudEntry(
  entries: DockHudEntries,
  definition: DockHudDescriptor | null,
): DockHudEntries {
  if (
    !definition ||
    areHudDefinitionsEqual(entries[definition?.id], definition)
  ) {
    return entries;
  }
  return {
    ...entries,
    [definition.id]: definition,
  };
}

export function removeHudEntries(
  entries: DockHudEntries,
  id: string | null = null,
): DockHudEntries {
  if (!id) return Object.keys(entries).length === 0 ? entries : {};
  if (!entries[id]) return entries;
  const next = {
    ...entries,
  };
  delete next[id];
  return next;
}

function resolveActiveHud(
  entries: (DockHudDescriptor | null)[],
): DockHudDescriptor | null {
  return toArray(entries).reduce<DockHudDescriptor | null>((active, hud) => {
    if (!hud?.isActive) return active;
    return !active ||
      normalizePriority(hud.priority) > normalizePriority(active.priority)
      ? hud
      : active;
  }, null);
}

export function areSelectionModeStatesEqual(
  current: DockHudDescriptor | null,
  next: DockHudDescriptor | null,
): boolean {
  return areHudDefinitionsEqual(current, next);
}

export function getActiveDockHud(
  entries: DockHudEntries,
  selectionMode: DockHudDescriptor | null,
): DockHudDescriptor | null {
  return resolveActiveHud([...Object.values(entries), selectionMode]);
}

const DEFAULT_COMPONENT_HUD_ID = "component-hud";

type DismissHandler = DockHudDescriptor["onDismiss"];

function resolveDirectContent(input: unknown, content: ReactNode): ReactNode {
  if (content != null) return content;
  const isRenderableInput =
    isValidElement(input) ||
    typeof input === "string" ||
    typeof input === "number";
  return isRenderableInput ? (input as ReactNode) : null;
}

function resolveHudId(
  descriptor: DockHudDescriptor | null,
  config: Partial<DockHudDescriptor>,
  component: DockComponent | null,
): string {
  const componentId = component
    ? component.displayName || component.name || DEFAULT_COMPONENT_HUD_ID
    : DEFAULT_HUD_ID;
  return String(descriptor?.id ?? config?.id ?? componentId);
}

function resolveDismissHandler(
  descriptor: DockHudDescriptor | null,
  config: Partial<DockHudDescriptor>,
): DismissHandler {
  const candidates = [
    descriptor?.onDismiss,
    descriptor?.onCancel,
    config?.onDismiss,
    config?.onCancel,
  ];
  const handler = candidates.find(
    (candidate) => typeof candidate === "function",
  );
  return handler ?? null;
}

/** Normalizes a component, node or descriptor into a HUD definition; null when empty. */
export function createHudDefinition(
  input: unknown,
  config: Partial<DockHudDescriptor> = {},
): DockHudDescriptor | null {
  if (input == null || input === false) return null;
  const descriptor = isHudDescriptor(input) ? input : null;
  const component = resolveComponentType(descriptor?.component, input);
  const content = resolveRenderableContent(
    descriptor?.content,
    descriptor?.node,
    descriptor?.element,
  );
  const directContent = resolveDirectContent(input, content);
  if (!component && directContent == null) return null;
  return {
    autoDismissMs: normalizeAutoDismiss(
      descriptor?.autoDismissMs ?? config?.autoDismissMs,
    ),
    component,
    content: component ? null : directContent,
    dismissOnEscape:
      descriptor?.dismissOnEscape ?? config?.dismissOnEscape ?? true,
    dismissOnNavigate:
      descriptor?.dismissOnNavigate ?? config?.dismissOnNavigate ?? true,
    id: resolveHudId(descriptor, config, component),
    isActive: Boolean(descriptor?.isActive ?? config?.isActive ?? true),
    onDismiss: resolveDismissHandler(descriptor, config),
    priority: normalizePriority(descriptor?.priority ?? config?.priority),
    props: component && isObject(descriptor?.props) ? descriptor.props : {},
    renderMode: component
      ? DOCK_HUD_RENDER_MODE.COMPONENT
      : DOCK_HUD_RENDER_MODE.NODE,
  };
}

/** Builds the HUD definition for selection mode, or null when it is off. */
export function createSelectionModeState(
  config: (Partial<DockHudDescriptor> & { id?: string }) | null | undefined,
): DockHudDescriptor | null {
  return config
    ? createHudDefinition(config, {
        id: config.id || "selection-mode",
        priority: DOCK_HUD_PRIORITY.SELECTION,
      })
    : null;
}

function buildOperationHudInput(
  operation: DockOperation,
  pendingCount: number,
): Record<string, unknown> {
  if (isHudDescriptor(operation.hud)) {
    return {
      ...operation.hud,
      props: {
        ...(isObject(operation.hud.props) ? operation.hud.props : {}),
        operation,
        pendingCount,
      },
    };
  }
  if (typeof operation.hud === "function") {
    return {
      component: operation.hud,
      props: {
        operation,
        pendingCount,
      },
    };
  }
  return { content: operation.hud };
}

/** Builds the progress HUD for a pending operation; null once it has settled. */
export function createDockOperationHud(
  operation: DockOperation | null | undefined,
  {
    onCancel = null,
    pendingCount = 1,
  }: { onCancel?: ((id: string) => void) | null; pendingCount?: number } = {},
) {
  if (
    !operation?.id ||
    operation.status !== DOCK_OPERATION_STATUS.PENDING ||
    operation.hud == null
  ) {
    return null;
  }
  const hudInput = buildOperationHudInput(operation, pendingCount);
  return createHudDefinition({
    ...hudInput,
    dismissOnEscape: false,
    dismissOnNavigate: false,
    id: "dock-operation:" + operation.id,
    isActive: true,
    onDismiss:
      operation.cancellable !== false && typeof onCancel === "function"
        ? () => onCancel(operation.id)
        : null,
    priority: DOCK_HUD_PRIORITY.TASK_PROGRESS + Number(operation.priority || 0),
  });
}
