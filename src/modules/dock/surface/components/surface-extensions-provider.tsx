"use client";

import { type ReactNode, useState } from "react";
import {
  SurfaceExtensionsContext,
  SurfaceExtensionsStore,
  SurfaceHeaderActionStore,
} from "../context";

export function SurfaceExtensionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [value] = useState(() => ({
    extensions: new SurfaceExtensionsStore(),
    headerActions: new SurfaceHeaderActionStore(),
  }));

  return (
    <SurfaceExtensionsContext value={value}>
      {children}
    </SurfaceExtensionsContext>
  );
}
