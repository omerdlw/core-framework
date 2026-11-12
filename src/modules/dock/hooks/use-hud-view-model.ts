"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DockHudDescriptor } from "../types";

export function useDockHudViewModel({
  clearHud,
  hud,
  pathname,
}: {
  clearHud?: ((id?: string) => void) | null;
  hud: DockHudDescriptor | null;
  pathname?: string | null;
}) {
  const previousPathRef = useRef(pathname);
  const dismiss = useCallback(() => {
    hud?.onDismiss?.();
    if (hud?.id) clearHud?.(hud.id);
  }, [clearHud, hud]);
  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    if (hud?.isActive && hud.dismissOnNavigate && hud.id) clearHud?.(hud.id);
  }, [clearHud, hud?.dismissOnNavigate, hud?.id, hud?.isActive, pathname]);
  useEffect(() => {
    if (!hud?.isActive || !hud?.dismissOnEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      dismiss();
    };
    window.addEventListener("keydown", onKeyDown, {
      capture: true,
    });
    return () =>
      window.removeEventListener("keydown", onKeyDown, {
        capture: true,
      });
  }, [dismiss, hud?.dismissOnEscape, hud?.isActive]);
  useEffect(() => {
    if (!hud?.isActive || !hud?.autoDismissMs) return;
    const timer = setTimeout(dismiss, hud.autoDismissMs);
    return () => clearTimeout(timer);
  }, [dismiss, hud?.autoDismissMs, hud?.isActive]);

  return { dismiss };
}
