import { type ReactNode } from "react";
import { type ExternalStore } from "@/utils";

export interface NotificationData {
  dedupeKey?: string;
  duration?: number | null;
  id?: string;
  message: ReactNode;
  timestamp?: number;
}

export interface NotificationEntry extends NotificationData {
  id: string;
  message: ReactNode;
  timestamp: number;
}

export interface NotificationState {
  notifications: Record<string, NotificationEntry>;
}

export interface NotificationOptions {
  dedupeKey?: string;
  duration?: number | null;
  id?: string;
}

export type ToastOptions = NotificationOptions;
export type ToastOptionsInput = number | NotificationOptions;

export interface NotificationActions {
  dismissAllNotifications: () => void;
  dismissNotification: (id: string) => void;
  showNotification: (
    messageOrData: ReactNode | NotificationData,
    options?: ToastOptionsInput,
  ) => string | null;
}

export interface NotificationProviderProps {
  children?: ReactNode;
}

export interface ToastPromiseMessages<T = unknown, E = unknown> {
  error?: ReactNode | ((error: E) => ReactNode);
  loading?: ReactNode;
  success?: ReactNode | ((data: T) => ReactNode);
}

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

export interface NotificationContextValue {
  actions: NotificationActions;
  store: ExternalStore<NotificationState>;
}

export type NotificationPageConfig = number | { duration?: number | null };

export interface NotificationPageApi {
  toast: ToastController;
  set: (notification: NotificationPageConfig) => void;
}

export type NotificationThemeSlot =
  "layer" | "toast" | "toastDocked" | "toastMessage";
