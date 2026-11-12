"use client";

import { type ReactNode, useState } from "react";
import { useGlobalEvent } from "@/react/hooks";
import type { DockBadgeState } from "../types";
import { DOCK_EVENTS } from "../constants";

export function useDockBadge(
  dockKey?: string | null,
  initialBadge?: ReactNode,
): DockBadgeState {
  const [badge, setBadge] = useState<DockBadgeState>({
    visible: Boolean(initialBadge),
    value: initialBadge as DockBadgeState["value"],
  });

  useGlobalEvent(
    dockKey ? DOCK_EVENTS.UPDATE_BADGE : null,
    (data?: {
      color?: string;
      key?: string;
      value?: string | number | null;
    }) => {
      if (data && data.key === dockKey) {
        setBadge({
          visible: data.value != null && data.value !== "",
          color: data.color,
          value: data.value,
        });
      }
    },
  );

  return badge;
}
