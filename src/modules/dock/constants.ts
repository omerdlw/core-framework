import { defineThemeSpec } from "../theme";
import { type DockThemeSlot } from "./types";

export const DOCK_STYLE_SECTIONS = Object.freeze([
  "card",
  "icon",
  "title",
  "description",
] as const);

export const DOCK_EVENTS = Object.freeze({
  NAVIGATE_START: "DOCK_NAVIGATE_START",
  NAVIGATE_END: "DOCK_NAVIGATE_END",
  UPDATE_BADGE: "DOCK_UPDATE_BADGE",
  NAVIGATE: "DOCK_NAVIGATE",
  GUARD: "DOCK_GUARD",
  NOT_FOUND: "DOCK_NOT_FOUND",
  STATUS_SET: "DOCK_STATUS_SET",
  STATUS_CLEAR: "DOCK_STATUS_CLEAR",
} as const);

export const DOCK_HUD_RENDER_MODE = Object.freeze({
  COMPONENT: "component",
  NODE: "node",
} as const);

export const DOCK_HUD_VARIANT = Object.freeze({
  EXPANDED: "expanded",
  PROGRESS: "progress",
  CUSTOM: "custom",
} as const);

export const DOCK_HUD_PRIORITY = Object.freeze({
  TASK_PROGRESS: 30,
  CONTEXTUAL: 10,
  SELECTION: 20,
  CRITICAL: 50,
  DEFAULT: 0,
  MEDIA: 15,
} as const);

export const DOCK_ATTENTION_KIND = Object.freeze({
  SURFACE: "surface",
  OPERATION: "operation",
  LOADING: "loading",
  STATUS: "status",
  ROUTE: "route",
  HUD: "hud",
} as const);

export const DOCK_ATTENTION_PRIORITY = Object.freeze({
  STATUS_OVERLAY: 300,
  SURFACE: 400,
  OPERATION: 250,
  LOADING: 100,
  STATUS: 75,
  ROUTE: 0,
  HUD: 200,
} as const);

export const DOCK_ATTENTION_PRIORITY_OFFSET_MAX = 99;

export const DOCK_SURFACE_RENDER_MODE = Object.freeze({
  COMPONENT: "component",
  NODE: "node",
} as const);

export const DOCK_SURFACE_FLOW_STATUS = Object.freeze({
  OPEN: "open",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const);

export const DOCK_SURFACE_PHASE = Object.freeze({
  IDLE: "idle",
  DISMISSING_ACTION: "dismissing_action",
  EXPANDING_BODY: "expanding_body",
  OPEN: "open",
  CLOSING_ANTICIPATION: "closing_anticipation",
  COLLAPSING_BODY: "collapsing_body",
  RESTORING_HEADER: "restoring_header",
} as const);

const DOCK_VIEWPORT_GAP = 4;
export const VIEWPORT_MARGIN = 24;

export const DOCK_CARD_DIMENSIONS = Object.freeze({
  expandedY: -(68 + DOCK_VIEWPORT_GAP),
  chromeHeight: 20,
  collapsedY: -10,
  extensionShelfY: -42,
  extensionShelfScale: 0.94,
  extensionShelfHeight: 45,
  hudHeight: 52,
  actionGap: 10,
  height: 68,
});

export const DOCK_CARD_LAYOUT = Object.freeze({
  collapsed: Object.freeze({
    offsetY: DOCK_CARD_DIMENSIONS.collapsedY,
    scale: 0.88,
  }),
  expanded: Object.freeze({
    offsetY: DOCK_CARD_DIMENSIONS.expandedY,
    scale: 1,
  }),
  extensionShelfY: DOCK_CARD_DIMENSIONS.extensionShelfY,
  extensionShelfScale: DOCK_CARD_DIMENSIONS.extensionShelfScale,
  extensionShelfHeight: DOCK_CARD_DIMENSIONS.extensionShelfHeight,
  chromeHeight: DOCK_CARD_DIMENSIONS.chromeHeight,
  hudHeight: DOCK_CARD_DIMENSIONS.hudHeight,
  actionGap: DOCK_CARD_DIMENSIONS.actionGap,
  baseHeight: DOCK_CARD_DIMENSIONS.height,
});

export const DOCK_TRANSACTION_EVENTS = Object.freeze({
  START: "START",
  COMPLETE: "COMPLETE",
  CANCEL: "CANCEL",
  FAIL: "FAIL",
  TIME_OUT: "TIME_OUT",
} as const);

export const DOCK_TRANSACTION_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed",
  TIMED_OUT: "timed-out",
} as const);

export const DOCK_TRANSACTION_REASON = Object.freeze({
  GUARD: "guard",
  SUPERSEDED: "superseded",
  TIME_OUT: "time-out",
} as const);

export const DOCK_TRANSACTION_TIMEOUT_MS = 15_000;
export const DOCK_PREFETCH_INTENT_DELAY_MS = 90;

export const DOCK_CONTINUITY_EVENTS = Object.freeze({
  CLEAR: "CLEAR",
  CONSUME_RETURN: "CONSUME_RETURN",
  DELIVER_RETURN: "DELIVER_RETURN",
  RECORD: "RECORD",
  REMOVE: "REMOVE",
} as const);

export const DOCK_CONTINUITY_MAX_ENTRIES = 32;
export const DOCK_SURFACE_RETURN_MAX_ENTRIES = 16;

export const DOCK_OPERATION_EVENTS = Object.freeze({
  CANCEL: "CANCEL",
  CLEAR: "CLEAR",
  COMPLETE: "COMPLETE",
  START: "START",
  UPDATE: "UPDATE",
} as const);

export const DOCK_OPERATION_STATUS = Object.freeze({
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  PENDING: "pending",
} as const);

export const DOCK_OPERATION_MAX_ENTRIES = 24;

export const DOCK_FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export const DOCK_FOCUS_RESTORE_BLOCKED_REASONS = Object.freeze([
  "browser-back",
  "dock",
  "unmount",
] as const);

export const DOCK_LIFECYCLE = Object.freeze({
  CLOSING: "closing",
  OPENING: "opening",
  IDLE: "idle",
  OPEN: "open",
} as const);

export const PLAYBACK_RATES = Object.freeze([1, 1.25, 1.5, 2] as const);

export const STATUS_PRIORITY: Record<string, number> = Object.freeze({
  GUARD: 120,
  ACCOUNT_DELETE: 115,
  APP_ERROR: 100,
  API_ERROR: 95,
  NOT_FOUND: 97,
  OFFLINE: 90,
  LOGOUT: 110,
  SIGNUP: 110,
  LOGIN: 110,
  ONLINE: 10,
});

export const ERROR_STATUS_TYPES = new Set([
  "GUARD",
  "ACCOUNT_DELETE",
  "APP_ERROR",
  "API_ERROR",
  "NOT_FOUND",
]);

export const OVERLAY_STATUS_STORAGE_KEY = "dock_overlay_status";
export const OVERLAY_STATUS_CLEAR_DURATION = 3000;
export const STATUS_CLEAR_DURATION = 4500;

export const API_ERROR_BATCH_DELAY = 300;
export const DOCK_HEIGHT_BUFFER = 16;
export const HEIGHT_EPSILON = 0.5;
export const MAX_VISIBLE_STACKED_CARDS = 3;

export const dockTheme = defineThemeSpec<DockThemeSlot>("dock");
