"use client";

import { useMemo, useState } from "react";
import { createStore } from "@/utils";
import { getOrCreateGlobalContext } from "@/kernel";
import { AMBIENT_DEFAULTS } from "./constants";
import type {
  AmbientProviderProps,
  AmbientProviderValue,
  AmbientState,
} from "./types";

export const AmbientContext =
  getOrCreateGlobalContext<AmbientProviderValue | null>("AmbientContext", null);

export function AmbientProvider({
  children,
  initialPalette = null,
}: AmbientProviderProps) {
  const [store] = useState(() =>
    createStore<AmbientState>(
      { isExtracting: false, palette: initialPalette || AMBIENT_DEFAULTS },
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
