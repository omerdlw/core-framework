"use client";

import { useCallback } from "react";

import { useTheme } from "@/react/theme";

import { dockTheme } from "../constants";
import { resolveDockActionClass } from "../lib/styles";

export function useDockTheme() {
  return useTheme(dockTheme);
}

export function useDockActionClass() {
  const { slots } = useDockTheme();
  return useCallback(
    (options?: Parameters<typeof resolveDockActionClass>[1]) =>
      resolveDockActionClass(slots, options),
    [slots],
  );
}
