"use client";

import { type ComponentType } from "react";
import { Icon } from "@/atoms";
import {
  type StatusState,
  type DockIconSource,
  type DockSlotContent,
  type DockStatusDescriptor,
  type DockStatusTheme,
  type ErrorActionsProps,
  type GuardActionsProps,
  type PersistedOverlayStatus,
  type DockItem,
} from "../types";
import {
  ERROR_STATUS_TYPES,
  STATUS_PRIORITY,
  OVERLAY_STATUS_STORAGE_KEY,
} from "../constants";
import { statusActionDefaults } from "../context";
import { normalizeUpper } from "../utils";

export type StatusSetter = React.Dispatch<React.SetStateAction<StatusState>>;

export type StatusUpdate =
  StatusState | ((current: StatusState) => StatusState);

export type TimerRef = React.MutableRefObject<ReturnType<
  typeof setTimeout
> | null>;

export function isErrorStatus(type: string): boolean {
  return ERROR_STATUS_TYPES.has(type);
}

function getStatusPriority(type: string): number {
  return STATUS_PRIORITY[type] ?? 0;
}

export function resolveStatusPriority(status: StatusState): number {
  if (!status) return 0;
  const { priority } = status;
  if (priority !== null && priority !== undefined) {
    const explicitPriority = Number(priority);
    if (Number.isFinite(explicitPriority)) return explicitPriority;
  }
  return getStatusPriority(status.type);
}

export function getStatusTheme(_type?: string) {
  return {
    description: { opacity: 1 },
  };
}

export function isEquivalentOverlayStatus(
  currentStatus: StatusState,
  nextStatus: StatusState,
): boolean {
  if (!currentStatus || !nextStatus?.type) return false;
  return (
    currentStatus.type === nextStatus.type &&
    currentStatus.flow === nextStatus.flow &&
    currentStatus.title === nextStatus.title &&
    currentStatus.description === nextStatus.description &&
    currentStatus.icon === nextStatus.icon &&
    currentStatus.isOverlay === nextStatus.isOverlay
  );
}

export function createOverlayStatus({
  type,
  title,
  description,
  icon,
  style,
  isOverlay = true,
  action = null,
  actions = null,
  flow = null,
  priority = null,
}: {
  type: string;
  title: string;
  description: string;
  icon?: DockIconSource;
  style?: DockStatusTheme;
  isOverlay?: boolean;
  action?: DockSlotContent;
  actions?: DockSlotContent;
  flow?: string | null;
  priority?: number | null;
}): DockStatusDescriptor {
  return {
    type,
    flow,
    isOverlay,
    priority,
    title,
    description,
    icon,
    style,
    action,
    actions,
    hideScroll: true,
  };
}

export function createErrorStatus({
  type,
  title,
  description,
  icon,
  style,
  onRetry,
  clearStatus,
  action,
  errorAction,
  retryLabel,
  refreshLabel,
  retryText,
  refreshText,
}: {
  type: string;
  title: string;
  description: string;
  icon?: DockIconSource;
  style?: DockStatusTheme;
  onRetry?: () => void;
  clearStatus?: () => void;
  action?: ComponentType<ErrorActionsProps> | null;
  errorAction?: ComponentType<ErrorActionsProps> | null;
  retryLabel?: string;
  refreshLabel?: string;
  retryText?: string;
  refreshText?: string;
}) {
  const retryHandler =
    typeof onRetry === "function"
      ? () => {
          clearStatus?.();
          onRetry();
        }
      : () => {
          window.location.reload();
        };
  return createOverlayStatus({
    type,
    title,
    description,
    icon,
    style,
    isOverlay: true,
    action: () => {
      const ActionComponent =
        action || errorAction || statusActionDefaults.error;
      return ActionComponent ? (
        <ActionComponent
          onRetry={retryHandler}
          onRefresh={() => window.location.reload()}
          retryLabel={retryLabel}
          refreshLabel={refreshLabel}
          retryText={retryText}
          refreshText={refreshText}
        />
      ) : null;
    },
  });
}

export function createGuardStatus({
  action,
  guardAction,
  title = "Navigation Blocked",
  description = "You have unsaved changes. Are you sure you want to leave?",
  icon = "solar:danger-triangle-bold",
  style,
  onConfirm,
  onCancel,
  cancelLabel,
  confirmLabel,
  cancelText = "Stay",
  confirmText = "Leave",
  clearStatus,
}: {
  action?: ComponentType<GuardActionsProps> | null;
  guardAction?: ComponentType<GuardActionsProps> | null;
  title?: string;
  description?: string;
  icon?: DockIconSource;
  style?: DockStatusTheme;
  onConfirm?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  cancelText?: string;
  confirmText?: string;
  clearStatus?: () => void;
}) {
  const cancelHandler = () => {
    clearStatus?.();
    onCancel?.();
  };
  const confirmHandler = () => {
    clearStatus?.();
    onConfirm?.();
  };
  const effectiveCancel = cancelLabel || cancelText;
  const effectiveConfirm = confirmLabel || confirmText;
  return createOverlayStatus({
    type: "GUARD",
    priority: STATUS_PRIORITY.GUARD,
    title,
    description,
    icon,
    style: style || getStatusTheme("GUARD"),
    isOverlay: true,
    action: () => {
      const GuardActionComponent =
        action || guardAction || statusActionDefaults.guard;
      return GuardActionComponent ? (
        <GuardActionComponent
          onCancel={cancelHandler}
          onConfirm={confirmHandler}
          cancelLabel={effectiveCancel}
          confirmLabel={effectiveConfirm}
          cancelText={effectiveCancel}
          confirmText={effectiveConfirm}
        />
      ) : null;
    },
  });
}

export function createConnectionStatus(type: string) {
  if (type === "OFFLINE") {
    return createOverlayStatus({
      type,
      title: "Connection Lost",
      description: "You are currently offline",
      icon: <Icon icon="lucide:wifi-off" size={24} />,
      style: getStatusTheme(type),
    });
  }
  return createOverlayStatus({
    type: "ONLINE",
    title: "Connection Restored",
    description: "You are back online",
    icon: <Icon icon="lucide:wifi" size={24} />,
    style: getStatusTheme("ONLINE"),
    isOverlay: false,
  });
}

let cachedSessionStorage: Storage | null | undefined;

function readSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  if (cachedSessionStorage !== undefined) return cachedSessionStorage;

  try {
    const storage = window.sessionStorage;
    if (!storage) {
      cachedSessionStorage = null;
      return null;
    }

    const probeKey = "__bf_storage_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    cachedSessionStorage = storage;
    return storage;
  } catch {
    cachedSessionStorage = null;
    return null;
  }
}

export function clearPersistedOverlayStatus(): void {
  try {
    readSessionStorage()?.removeItem(OVERLAY_STATUS_STORAGE_KEY);
  } catch {}
}

export function persistOverlayStatus(
  status: StatusState,
  duration: number,
): void {
  const storage = readSessionStorage();
  if (!status || !isPersistableOverlayStatus(status) || !storage) return;
  try {
    storage.setItem(
      OVERLAY_STATUS_STORAGE_KEY,
      JSON.stringify({
        description: status.description || "",
        expiresAt: Date.now() + Math.max(0, Number(duration) || 0),
        flow: status.flow || null,
        icon: typeof status.icon === "string" ? status.icon : null,
        priority: resolveStatusPriority(status),
        title: status.title || "",
        type: status.type,
      }),
    );
  } catch {}
}

export function restorePersistedOverlayStatus(): {
  remainingMs: number;
  status: DockStatusDescriptor;
} | null {
  const storage = readSessionStorage();
  if (!storage) return null;
  try {
    const rawValue = storage.getItem(OVERLAY_STATUS_STORAGE_KEY);
    if (!rawValue) return null;

    const payload: PersistedOverlayStatus | null = JSON.parse(rawValue);
    const type = normalizeUpper(payload?.type);
    const expiresAt = Number(payload?.expiresAt || 0);

    if (!type || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      clearPersistedOverlayStatus();
      return null;
    }

    return {
      remainingMs: expiresAt - Date.now(),
      status: createOverlayStatus({
        type,
        flow: payload?.flow || null,
        priority: Number.isFinite(Number(payload?.priority))
          ? Number(payload?.priority)
          : null,
        title: payload?.title || "Status",
        description: payload?.description || "",
        icon: payload?.icon || null,
        style: getStatusTheme(type),
      }),
    };
  } catch {
    clearPersistedOverlayStatus();
    return null;
  }
}

export function isPersistableOverlayStatus(status: StatusState): boolean {
  return (
    Boolean(status?.type) &&
    !isErrorStatus(status!.type) &&
    (typeof status!.icon === "string" || status!.icon == null)
  );
}

export function applyStatusOverlay(
  item: DockItem | null,
  statusState: StatusState,
): DockItem | null {
  if (!item || !statusState) return item;
  const showStatusActions =
    statusState.type === "APP_ERROR" ||
    statusState.type === "API_ERROR" ||
    statusState.type === "GUARD" ||
    Boolean(statusState.action);
  return {
    ...item,
    ...statusState,
    activeChild: null,
    children: null,
    hasActiveChild: false,
    isExpanded: false,
    isParent: false,
    isStatus: true,
    badge: null,
    iconOverlay: null,
    action: showStatusActions ? statusState.action : null,
    actions: showStatusActions ? statusState.actions : null,
  };
}
