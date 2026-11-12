"use client";

import { type Dispatch, type SetStateAction, useState } from "react";

import {
  areSelectionModeStatesEqual,
  type DockHudEntries,
  getActiveDockHud,
  removeHudEntries,
  upsertHudEntry,
} from "../model/hud";
import {
  createHudDefinition,
  createSelectionModeState,
} from "../model/hud-definition";
import type { DockHudDescriptor } from "../types";

function createHudActions(
  setHudEntries: Dispatch<SetStateAction<DockHudEntries>>,
  setSelectionModeState: Dispatch<SetStateAction<DockHudDescriptor | null>>,
) {
  return {
    actions: {
      clearHud: (targetId?: string) => {
        setHudEntries((prev) => removeHudEntries(prev, targetId));
      },
      clearSelectionMode: () => setSelectionModeState(null),
      setHud: (descriptor: DockHudDescriptor) => {
        const definition = createHudDefinition(descriptor);
        if (!definition) return;
        setHudEntries((prev) => upsertHudEntry(prev, definition));
      },
      setSelectionMode: (
        config: Parameters<typeof createSelectionModeState>[0],
      ) => {
        setSelectionModeState((curr) => {
          const nextSelection = createSelectionModeState(config);
          return areSelectionModeStatesEqual(curr, nextSelection)
            ? curr
            : nextSelection;
        });
      },
    },
    clearTransientHud: () => {
      setSelectionModeState(null);
      setHudEntries({});
    },
  };
}

export function useDockHudRegistry() {
  const [selectionModeState, setSelectionModeState] =
    useState<DockHudDescriptor | null>(null);
  const [hudEntries, setHudEntries] = useState<DockHudEntries>({});
  const [{ actions, clearTransientHud }] = useState(() =>
    createHudActions(setHudEntries, setSelectionModeState),
  );

  // getActiveDockHud returns an existing entry (or null), so this keeps the
  // hud's identity without a memo.
  const registeredHud = getActiveDockHud(hudEntries, selectionModeState);

  return {
    actions,
    clearTransientHud,
    hudEntries,
    registeredHud,
    selectionModeState,
  };
}
