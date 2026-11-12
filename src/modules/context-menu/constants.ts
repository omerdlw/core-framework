import { defineThemeSpec } from "@/react/theme";

import {
  type ContextMenuMotion,
  type ContextMenuPosition,
  type ContextMenuThemeSlot,
} from "./types";

/**
 * Theme spec for the context menu's styling slots and motion.
 */
export const contextMenuTheme = defineThemeSpec<
  ContextMenuThemeSlot,
  ContextMenuMotion
>("context-menu");

/**
 * Registry key of the menu that applies to the current page.
 */
export const CURRENT_PAGE_KEY = "current-page";
/**
 * Registry key of the menu that applies on every page.
 */
export const GLOBAL_MENU_KEY = "*";
/**
 * Smallest distance, in pixels, between the menu and the viewport edge.
 */
export const MENU_SCREEN_MARGIN = 10;
export const REGISTRY_CLEANUP_DELAY_MS = 600;
export const HEADER_ICON_SIZE = 20;
export const ITEM_ICON_SIZE = 18;

/** Weights that rank competing menus: priority, then route, then target. */
export const PRIORITY_WEIGHT = 10_000;
export const ROUTE_WEIGHT = 100;
export const EXACT_ROUTE_SCORE = 100;
export const CURRENT_PAGE_SCORE = 70;
export const GLOBAL_MENU_SCORE = 40;
export const DEFAULT_ROUTE_SCORE = 10;
export const MAX_TARGET_SCORE = 100;

/**
 * Name of the window event fired when the menu opens or closes.
 */
export const CONTEXT_MENU_VISIBILITY_EVENT = "context-menu:visibility";
/**
 * Menu position used while the menu is closed.
 */
export const INITIAL_POSITION: ContextMenuPosition = Object.freeze({
  x: 0,
  y: 0,
});
