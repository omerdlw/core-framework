"use client";

import { type ReactNode, use } from "react";
import type { DockIconSource } from "../../types";
import { DockSurfaceHeaderRadiusContext } from "../context";

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
