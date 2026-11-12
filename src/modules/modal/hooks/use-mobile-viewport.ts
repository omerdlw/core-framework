"use client";

import { useEffect, useState } from "react";

import { MODAL_BREAKPOINTS } from "../constants";
import { getViewportIsMobile } from "../model/layout";

/** Whether the viewport is in the mobile range; follows resizes. */
export function useMobileViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState(getViewportIsMobile);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia(
      `(max-width: ${MODAL_BREAKPOINTS.MOBILE_MAX_WIDTH}px)`,
    );
    const handleViewportChange = (e: MediaQueryListEvent) =>
      setIsMobileViewport(e.matches);

    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  return isMobileViewport;
}
