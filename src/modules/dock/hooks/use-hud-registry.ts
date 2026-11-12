"use client";

import { useCallback, useMemo, useState } from "react";
import type { DockHudDescriptor } from "../types";
import {
  type DockHudEntries,
  areSelectionModeStatesEqual,
  getActiveDockHud,
  removeHudEntries,
  upsertHudEntry,
} from "../model/hud";
import {
  createHudDefinition,
  createSelectionModeState,
} from "../model/hud-definition";

export function useDockHudRegistry() {
  const [selectionModeState, setSelectionModeState] =
    useState<DockHudDescriptor | null>(null);
  const [hudEntries, setHudEntries] = useState<DockHudEntries>({});

  const setHud = useCallback((descriptor: DockHudDescriptor) => {
    const definition = createHudDefinition(descriptor);
    if (!definition) return;
    setHudEntries((prev) => upsertHudEntry(prev, definition));
  }, []);

  const clearHud = useCallback((targetId?: string) => {
    setHudEntries((prev) => removeHudEntries(prev, targetId));
  }, []);

  const setSelectionMode = useCallback(
    (config: Parameters<typeof createSelectionModeState>[0]) => {
      setSelectionModeState((curr) => {
        const nextSelection = createSelectionModeState(config);
        return areSelectionModeStatesEqual(curr, nextSelection)
          ? curr
          : nextSelection;
      });
    },
    [],
  );

  const clearSelectionMode = useCallback(() => setSelectionModeState(null), []);

  const clearTransientHud = useCallback(() => {
    setSelectionModeState(null);
    setHudEntries({});
  }, []);

  const registeredHud = useMemo(
    () => getActiveDockHud(hudEntries, selectionModeState),
    [hudEntries, selectionModeState],
  );

  const actions = useMemo(
    () => ({ clearHud, clearSelectionMode, setHud, setSelectionMode }),
    [clearHud, clearSelectionMode, setHud, setSelectionMode],
  );

  return {
    actions,
    clearTransientHud,
    hudEntries,
    registeredHud,
    selectionModeState,
  };
}
