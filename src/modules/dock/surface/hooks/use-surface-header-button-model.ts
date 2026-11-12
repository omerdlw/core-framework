"use client";

import { type ReactNode, createContext, use } from "react";
import type { DockIconSource } from "../../types";

export const DockSurfaceHeaderRadiusContext = createContext<string | null>(
  null,
);

export function useDockSurfaceHeaderButtonModel(_props: {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  ariaLabel?: string;
  icon?: DockIconSource;
}) {
  const contextRadius = use(DockSurfaceHeaderRadiusContext);

  return { contextRadius };
}
