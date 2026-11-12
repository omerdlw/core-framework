"use client";

import { useMemo, useState } from "react";

import { getOrCreateGlobalContext } from "@/core/kernel";
import { createStore } from "@/foundation/utils";

import type {
  AmbientProviderProps,
  AmbientProviderValue,
  AmbientState,
} from "./types";

/**
 * React context holding the ambient store and actions.
 */
export const AmbientContext =
  getOrCreateGlobalContext<AmbientProviderValue | null>("AmbientContext", null);

/**
 * Provides the ambient state to its children.
 */
export function AmbientProvider({
  children,
  initialPalette = null,
}: AmbientProviderProps) {
  const [store] = useState(() =>
    createStore<AmbientState>(
      { isExtracting: false, palette: initialPalette },
      { freezeSnapshots: false },
    ),
  );

  const value = useMemo<AmbientProviderValue>(
    () => ({
      actions: {
        setIsExtracting: (next) =>
          store.publish((state) => {
            const isExtracting =
              typeof next === "function" ? next(state.isExtracting) : next;
            return isExtracting === state.isExtracting
              ? state
              : { ...state, isExtracting };
          }),
        setPalette: (next) =>
          store.publish((state) => {
            const palette =
              typeof next === "function" ? next(state.palette) : next;
            return palette === state.palette ? state : { ...state, palette };
          }),
      },
      store,
    }),
    [store],
  );

  return <AmbientContext value={value}>{children}</AmbientContext>;
}
