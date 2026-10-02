import { toFiniteNumber } from "@/utils";
import { INITIAL_POSITION } from "./constants";
import { type ContextMenuOpenInput, type ContextMenuState } from "./types";

export function createInitialMenuState(): ContextMenuState {
  return {
    position: INITIAL_POSITION,
    context: null,
    isOpen: false,
    config: null,
    items: [],
  };
}

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
