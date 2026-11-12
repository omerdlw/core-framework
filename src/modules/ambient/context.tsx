"use client";

import { useState } from "react";

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

function createAmbientValue(
  initialPalette: AmbientState["palette"],
): AmbientProviderValue {
  const store = createStore<AmbientState>(
    { isExtracting: false, palette: initialPalette },
    { freezeSnapshots: false },
  );
  return {
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
  };
}

/**
 * Provides the ambient state to its children.
 */
export function AmbientProvider({
  children,
  initialPalette = null,
}: AmbientProviderProps) {
  const [value] = useState(() => createAmbientValue(initialPalette));

  return <AmbientContext value={value}>{children}</AmbientContext>;
}
