"use client";

import { type ReactNode, use } from "react";

import {
  defaultUi,
  type RegisteredUi,
  type Ui,
  type UiMotion,
} from "@/foundation/recipes/define";
import { retimeModuleMotion } from "@/foundation/utils/tempo";
import { getOrCreateGlobalContext } from "@/react/context";
import { useMotionTokens } from "@/react/theme";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- RegisteredUi collapses to Ui here but differs once consumers augment it
const UiContext = getOrCreateGlobalContext<Ui>("UiContext", defaultUi as Ui);

interface UiProviderProps {
  children?: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents -- RegisteredUi collapses to Ui here but differs once consumers augment it
  ui: RegisteredUi | Ui;
}

/**
 * Provides a UI definition (from `defineUi`) to the components below it.
 */
export function UiProvider({ children, ui }: UiProviderProps) {
  // RegisteredUi is the augmented Ui; the context stores the base Ui type.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- RegisteredUi collapses to Ui here but differs once consumers augment it
  return <UiContext value={ui as Ui}>{children}</UiContext>;
}

/**
 * Returns the current UI definition.
 */
export function useUi(): Ui {
  return use(UiContext);
}

// Cached per motion and clock, so the hook returns a stable object without memo.
const retimed = new WeakMap<
  UiMotion,
  Map<string, UiMotion & { readonly reduced: boolean }>
>();

/**
 * Returns the UI definition's motion retimed to the current tempo, plus whether motion is reduced.
 */
export function useUiMotion(): UiMotion & { readonly reduced: boolean } {
  const { motion } = useUi();
  const { reduced, still, tempo } = useMotionTokens();
  let byClock = retimed.get(motion);
  if (!byClock) {
    byClock = new Map();
    retimed.set(motion, byClock);
  }
  const id = `${tempo}:${reduced}`;
  let value = byClock.get(id);
  if (!value) {
    value = {
      ...retimeModuleMotion(motion, { reduced, still, tempo }),
      reduced,
    };
    byClock.set(id, value);
  }
  return value;
}
