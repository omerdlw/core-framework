import type { ComponentType } from "react";

import type {
  DockIconSource,
  DockStatusTheme,
  ErrorActionsProps,
  GuardActionsProps,
} from "../types";

export interface ErrorStatusOptions {
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
}

export interface GuardStatusOptions {
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
}

export function reloadPage() {
  window.location.reload();
}

export function createRetryHandler(
  onRetry?: () => void,
  clearStatus?: () => void,
) {
  if (typeof onRetry !== "function") return reloadPage;
  return () => {
    clearStatus?.();
    onRetry();
  };
}
