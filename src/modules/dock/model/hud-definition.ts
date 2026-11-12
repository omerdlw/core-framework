import { type ReactNode, isValidElement } from "react";
import { isObject } from "@/foundation/utils";
import type { DockHudDescriptor, DockOperation } from "../types";
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
import { normalizeAutoDismiss, normalizePriority } from "./hud";

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
  const directContent =
    content ??
    (isValidElement(input) ||
    typeof input === "string" ||
    typeof input === "number"
      ? (input as ReactNode)
      : null);
  if (!component && directContent == null) return null;
  const id =
    descriptor?.id ??
    config?.id ??
    (component
      ? component.displayName || component.name || "component-hud"
      : "hud");
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
    id: String(id),
    isActive: Boolean(descriptor?.isActive ?? config?.isActive ?? true),
    onDismiss:
      typeof descriptor?.onDismiss === "function"
        ? descriptor.onDismiss
        : typeof descriptor?.onCancel === "function"
          ? descriptor.onCancel
          : typeof config?.onDismiss === "function"
            ? config.onDismiss
            : typeof config?.onCancel === "function"
              ? config.onCancel
              : null,
    priority: normalizePriority(descriptor?.priority ?? config?.priority),
    props: component && isObject(descriptor?.props) ? descriptor.props : {},
    renderMode: component
      ? DOCK_HUD_RENDER_MODE.COMPONENT
      : DOCK_HUD_RENDER_MODE.NODE,
  };
}

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
  const hudInput = isHudDescriptor(operation.hud)
    ? {
        ...operation.hud,
        props: {
          ...(isObject(operation.hud.props) ? operation.hud.props : {}),
          operation,
          pendingCount,
        },
      }
    : typeof operation.hud === "function"
      ? {
          component: operation.hud,
          props: {
            operation,
            pendingCount,
          },
        }
      : {
          content: operation.hud,
        };
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
