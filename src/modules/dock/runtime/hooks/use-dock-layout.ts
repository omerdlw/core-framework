"use client";

import { usePathname } from "next/navigation";

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

  const { displayItems, displayActiveIndex } = computeDockLayout(
    dockItems,
    activeItem,
    pathname,
  );

  return {
    displayItems,
    activeIndex: displayActiveIndex,
  };
}
