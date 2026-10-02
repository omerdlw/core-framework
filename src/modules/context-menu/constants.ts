import { defineThemeSpec } from "../theme";
import { type ContextMenuPosition, type ContextMenuThemeSlot } from "./types";

export const contextMenuTheme =
  defineThemeSpec<ContextMenuThemeSlot>("context-menu");

export const CURRENT_PAGE_KEY = "current-page";
export const GLOBAL_MENU_KEY = "*";
export const MENU_SCREEN_MARGIN = 10;

export const CONTEXT_MENU_VISIBILITY_EVENT = "context-menu:visibility";
export const INITIAL_POSITION: ContextMenuPosition = Object.freeze({
  x: 0,
  y: 0,
});
