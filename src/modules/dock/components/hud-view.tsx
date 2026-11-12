"use client";

import { DOCK_HUD_RENDER_MODE } from "../constants";
import { useDockHudViewModel } from "../hooks/use-hud-view-model";
import { isValidComponentType } from "../lib/element-helpers";
import type { DockHudDescriptor } from "../types";

export function DockHudView({
  clearHud,
  hud,
  pathname,
}: {
  clearHud?: ((id?: string) => void) | null;
  hud: DockHudDescriptor | null;
  pathname?: string | null;
}) {
  const { dismiss } = useDockHudViewModel({ clearHud, hud, pathname });
  if (!hud?.isActive) return null;
  if (
    hud.renderMode === DOCK_HUD_RENDER_MODE.COMPONENT &&
    isValidComponentType(hud.component)
  ) {
    const Component = hud.component;
    return <Component {...hud.props} onDismiss={dismiss} />;
  }
  return hud.content ?? null;
}
