"use client";

import { useEffect, useRef } from "react";

export function useDockRouteReset(
  pathname: string | null,
  onRouteChange?: (path: string | null) => void,
) {
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    onRouteChange?.(pathname);
  }, [onRouteChange, pathname]);
}
