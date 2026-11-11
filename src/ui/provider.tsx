"use client";

import {
  createElement,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { getOrCreateGlobalContext } from "@/kernel";
import { useMotionTokens } from "@/theme";
import { retimeModuleMotion } from "@/tokens";
import {
  defaultUi,
  type RegisteredUi,
  type Ui,
  type UiMotion,
} from "./define";

const UiContext = getOrCreateGlobalContext<Ui>("UiContext", defaultUi as Ui);

/**
 * Hands the app's `defineUi(...)` result to every component below it. A nested
 * provider restyles its subtree (a dark panel, a dense table). Without a
 * provider the components use the library's defaults.
 *
 * Mount it in a client file (the app's providers): a ui holds functions, so it
 * cannot cross from a Server Component as a prop.
 */
export function UiProvider({
  children,
  ui,
}: {
  children?: ReactNode;
  ui: RegisteredUi | Ui;
}) {
  return createElement(UiContext.Provider, { value: ui as Ui }, children);
}

/** The ui in effect: its compiled parts, `cn`, icons, labels and motion. */
export function useUi(): Ui {
  return useContext(UiContext);
}

const retimed = new WeakMap<UiMotion, Map<string, UiMotion>>();

/**
 * The ui's motion, retimed by the app's tempo and collapsed for reduced motion
 * (the `motion` tokens given to `ThemeProvider`), plus whether motion is reduced.
 */
export function useUiMotion(): UiMotion & { readonly reduced: boolean } {
  const { motion } = useUi();
  const { reduced, tempo } = useMotionTokens();
  return useMemo(() => {
    let byClock = retimed.get(motion);
    if (!byClock) {
      byClock = new Map();
      retimed.set(motion, byClock);
    }
    const id = `${tempo}:${reduced}`;
    let value = byClock.get(id);
    if (!value) {
      value = retimeModuleMotion(motion, { reduced, tempo }) as UiMotion;
      byClock.set(id, value);
    }
    return { ...value, reduced };
  }, [motion, reduced, tempo]);
}
