import { type Transition, type Variants } from "motion/react";
import { type ReactNode } from "react";

import { type ExternalStore } from "@/foundation/utils";

/**
 * A notification as passed to showNotification: a message plus optional id,
 * dedupe key and duration.
 */
export interface NotificationData {
  dedupeKey?: string;
  duration?: number | null;
  id?: string;
  message: ReactNode;
  timestamp?: number;
}

/**
 * A notification held in state, with its id and creation time.
 */
export interface NotificationEntry extends NotificationData {
  id: string;
  message: ReactNode;
  timestamp: number;
}

/**
 * Observable state: the notifications currently shown, by id.
 */
export interface NotificationState {
  notifications: Record<string, NotificationEntry>;
}

/**
 * Options for one notification: id, dedupe key and duration.
 */
export interface NotificationOptions {
  dedupeKey?: string;
  duration?: number | null;
  id?: string;
}

/**
 * Options for one toast.
 */
export type ToastOptions = NotificationOptions;
/**
 * Toast options, or just a duration in milliseconds.
 */
export type ToastOptionsInput = number | NotificationOptions;

/**
 * Functions that show and dismiss notifications.
 */
export interface NotificationActions {
  dismissAllNotifications: () => void;
  dismissNotification: (id: string) => void;
  showNotification: (
    messageOrData: ReactNode | NotificationData,
    options?: ToastOptionsInput,
  ) => string | null;
}

/**
 * Props of NotificationProvider.
 */
export interface NotificationProviderProps {
  children?: ReactNode;
}

/**
 * Messages shown while a promise is loading, succeeds or fails.
 */
export interface ToastPromiseMessages<T = unknown, E = unknown> {
  error?: ReactNode | ((error: E) => ReactNode);
  loading?: ReactNode;
  success?: ReactNode | ((data: T) => ReactNode);
}

/**
 * Callable toast API: show a toast, dismiss it, or report a promise or result.
 */
export interface ToastController {
  (message: ReactNode, options?: ToastOptionsInput): string | null;
  dismiss: (id?: string) => void;
  dismissAll: () => void;
  fromResult: <T = unknown, E = unknown, R = unknown>(
    result: R,
    messages?: ToastPromiseMessages<T, E>,
    options?: ToastOptionsInput,
  ) => R;
  promise: <T = unknown, E = unknown>(
    promiseOrFn: Promise<T> | (() => Promise<T>),
    messages?: ToastPromiseMessages<T, E>,
    options?: ToastOptionsInput,
  ) => Promise<T>;
}

/**
 * Value held by NotificationContext: a store and its actions.
 */
export interface NotificationContextValue {
  actions: NotificationActions;
  store: ExternalStore<NotificationState>;
}

/**
 * The `notification` page setting: the default toast duration.
 */
export type NotificationPageConfig = number | { duration?: number | null };

/**
 * The notification API available on a page controller.
 */
export interface NotificationPageApi {
  toast: ToastController;
  set: (notification: NotificationPageConfig) => void;
}

/**
 * Theme slots of the notification layer.
 */
export type NotificationThemeSlot =
  "layer" | "toast" | "toastDocked" | "toastMessage";

/**
 * Motion variants and transition of a toast.
 */
export interface NotificationMotion {
  toast: Variants;
  transition: Transition;
}
