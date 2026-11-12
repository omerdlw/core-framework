"use client";

import { createElement, useContext, useMemo, type ReactNode } from "react";
import { getOrCreateGlobalContext } from "@/kernel";
import { useMotionTokens } from "@/theme";
import { retimeModuleMotion } from "@/utils/tempo";
import { defaultUi, type RegisteredUi, type Ui, type UiMotion } from "./define";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- RegisteredUi collapses to Ui here but differs once consumers augment it
const UiContext = getOrCreateGlobalContext<Ui>("UiContext", defaultUi as Ui);

export function UiProvider({
  children,
  ui,
}: {
  children?: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents -- RegisteredUi collapses to Ui here but differs once consumers augment it
  ui: RegisteredUi | Ui;
}) {
  // RegisteredUi is the augmented Ui; the context stores the base Ui type.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- RegisteredUi collapses to Ui here but differs once consumers augment it
  return createElement(UiContext.Provider, { value: ui as Ui }, children);
}

export function useUi(): Ui {
  return useContext(UiContext);
}

const retimed = new WeakMap<UiMotion, Map<string, UiMotion>>();

export function useUiMotion(): UiMotion & { readonly reduced: boolean } {
  const { motion } = useUi();
  const { reduced, still, tempo } = useMotionTokens();
  return useMemo(() => {
    let byClock = retimed.get(motion);
    if (!byClock) {
      byClock = new Map();
      retimed.set(motion, byClock);
    }
    const id = `${tempo}:${reduced}`;
    let value = byClock.get(id);
    if (!value) {
      value = retimeModuleMotion(motion, { reduced, still, tempo });
      byClock.set(id, value);
    }
    return { ...value, reduced };
  }, [motion, reduced, still, tempo]);
}
