import { USER_MESSAGES } from "@/foundation/utils";
import { defineThemeSpec } from "@/react/theme";

import {
  type NotificationActions,
  type NotificationMotion,
  type NotificationState,
  type NotificationThemeSlot,
} from "./types";

/**
 * Default toast durations in milliseconds.
 */
export const TOAST_DURATIONS = Object.freeze({
  DEFAULT: 2000,
  SHORT: 1500,
} as const);

/** Longest text message that still serves as its own notification id. */
export const MESSAGE_ID_LENGTH = 64;

/**
 * Message shown when the API reports an unauthorized session.
 */
export const SESSION_EXPIRED_MESSAGE = USER_MESSAGES.unauthorized;

/**
 * DOM id of the dock card stack that toasts dock into.
 */
export const DOCK_STACK_ELEMENT_ID = "dock-card-stack";

/**
 * Theme spec for the notification layer.
 */
export const notificationTheme = defineThemeSpec<
  NotificationThemeSlot,
  NotificationMotion
>("notification");

/**
 * Notification state with nothing shown.
 */
export const INITIAL_NOTIFICATION_STATE: NotificationState = Object.freeze({
  notifications: {},
});

/**
 * Notification actions that do nothing; used outside a NotificationProvider.
 */
export const INERT_NOTIFICATION_ACTIONS: NotificationActions = Object.freeze({
  dismissAllNotifications: () => {},
  dismissNotification: () => {},
  showNotification: () => null,
});
