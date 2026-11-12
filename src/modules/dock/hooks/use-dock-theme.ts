"use client";

import { useCallback } from "react";
import { useModuleTheme } from "@/react/theme";
import { dockTheme } from "../constants";
import { resolveDockActionClass } from "../lib/styles";

export function useDockTheme() {
  return useModuleTheme(dockTheme);
}

export function useDockActionClass() {
  const { slots } = useDockTheme();
  return useCallback(
    (options?: Parameters<typeof resolveDockActionClass>[1]) =>
      resolveDockActionClass(slots, options),
    [slots],
  );
}
