"use client";

import { useEffect, useEffectEvent, useRef } from "react";

export function useDockRouteReset(
  pathname: string | null,
  onRouteChange?: (path: string | null) => void,
) {
  const previousPathRef = useRef(pathname);
  const notifyRouteChange = useEffectEvent((path: string | null) => {
    onRouteChange?.(path);
  });

  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    notifyRouteChange(pathname);
  }, [pathname]);
}
