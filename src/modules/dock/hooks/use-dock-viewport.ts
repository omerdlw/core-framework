"use client";

import { useEffect, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/react/hooks";
import type { DockItem } from "../types";
import { getDockCardWidth, getTargetItemWidth } from "../model/layout";

export function useDockViewport(activeItem: DockItem | null = null) {
  const targetWidth = getTargetItemWidth(activeItem);
  const [, setViewportRevision] = useState(0);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const stackWidth = getDockCardWidth({ width: targetWidth });

  useIsomorphicLayoutEffect(() => {
    if (typeof document !== "undefined") setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let resizeFrameId: number | null = null;

    const handleResize = () => {
      if (resizeFrameId !== null) return;
      resizeFrameId = window.requestAnimationFrame(() => {
        resizeFrameId = null;
        setViewportRevision((revision) => revision + 1);
      });
    };

    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeFrameId !== null) window.cancelAnimationFrame(resizeFrameId);
    };
  }, []);

  return { portalTarget, stackWidth };
}
