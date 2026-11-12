"use client";

import { useCallback } from "react";

import { useTheme } from "@/react/theme";

import { dockTheme } from "../constants";
import { resolveDockActionClass } from "../lib/styles";

/** Returns the active dock theme (slots, styles and motion). */
export function useDockTheme() {
  return useTheme(dockTheme);
}

/** Returns a function that resolves class names for dock action buttons. */
export function useDockActionClass() {
  const { slots } = useDockTheme();
  // stable identity: part of the public hook contract
  return useCallback(
    (options?: Parameters<typeof resolveDockActionClass>[1]) =>
      resolveDockActionClass(slots, options),
    [slots],
  );
}
