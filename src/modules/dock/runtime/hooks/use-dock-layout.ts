"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

import type { DockItem } from "../../types";
import { computeDockLayout } from "../model/layout";

export function useDockLayout({
  dockItems,
  activeItem,
  pathname: overridePathname,
}: {
  dockItems?: DockItem[];
  activeItem?: DockItem | null;
  pathname?: string;
} = {}) {
  const routePathname = usePathname();
  const pathname = overridePathname || routePathname;

  // stable identity: displayItems is part of useDock's result
  const { displayItems, displayActiveIndex } = useMemo(
    () => computeDockLayout(dockItems, activeItem, pathname),
    [pathname, dockItems, activeItem],
  );

  return {
    displayItems,
    activeIndex: displayActiveIndex,
  };
}
