import { isValidElement, type ReactNode } from "react";

import { isObject } from "@/foundation/utils";

import {
  DOCK_HUD_PRIORITY,
  DOCK_HUD_RENDER_MODE,
  DOCK_OPERATION_STATUS,
} from "../constants";
import {
  isHudDescriptor,
  resolveComponentType,
  resolveRenderableContent,
} from "../lib/element-helpers";
import type { DockComponent, DockHudDescriptor, DockOperation } from "../types";
import { normalizeAutoDismiss, normalizePriority } from "./hud";

const DEFAULT_HUD_ID = "hud";
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
