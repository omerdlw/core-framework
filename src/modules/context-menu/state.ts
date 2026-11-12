import { isBrowser, toFiniteNumber } from "@/foundation/utils";

import { CONTEXT_MENU_VISIBILITY_EVENT, INITIAL_POSITION } from "./constants";
import { type ContextMenuOpenInput, type ContextMenuState } from "./types";

/**
 * The closed menu state.
 */
export function createInitialMenuState(): ContextMenuState {
  return {
    position: INITIAL_POSITION,
    context: null,
    isOpen: false,
    config: null,
    items: [],
  };
}

/**
 * Builds the open state from an openMenu input, or null when it has no config.
 */
export function resolveNextOpenState({
  config,
  context,
  items,
  position,
}: ContextMenuOpenInput): ContextMenuState | null {
  if (!config) return null;
  return {
    config,
    context: context ?? null,
    isOpen: true,
    items: items ?? [],
    position: {
      x: Math.round(toFiniteNumber(position?.x, 0)),
      y: Math.round(toFiniteNumber(position?.y, 0)),
    },
  };
}

/**
 * Fires the window event that tells others whether the menu is open.
 */
export function emitContextMenuVisibility(isOpen: boolean): void {
  if (!isBrowser) return;
  window.dispatchEvent(
    new CustomEvent(CONTEXT_MENU_VISIBILITY_EVENT, {
      detail: { isOpen: Boolean(isOpen) },
    }),
  );
}
