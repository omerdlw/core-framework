"use client";

import type { ReactNode } from "react";
import type { SurfaceFlowContextValue } from "../../types";
import { SurfaceFlowContext } from "../context";

export function SurfaceFlowProvider({
  children,
  value,
}: {
  children?: ReactNode;
  value: SurfaceFlowContextValue;
}) {
  return <SurfaceFlowContext value={value}>{children}</SurfaceFlowContext>;
}
