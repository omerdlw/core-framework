import { USER_MESSAGES } from "@/utils";
import { defineThemeSpec } from "../theme";
import { type NotificationThemeSlot } from "./types";

export const TOAST_DURATIONS = Object.freeze({
  DEFAULT: 2000,
  SHORT: 1500,
} as const);

export const SESSION_EXPIRED_MESSAGE = USER_MESSAGES.unauthorized;

export const DOCK_STACK_ELEMENT_ID = "dock-card-stack";

export const notificationTheme =
  defineThemeSpec<NotificationThemeSlot>("notification");
