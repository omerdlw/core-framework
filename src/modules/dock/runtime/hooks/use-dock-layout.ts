"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

import type { DockItem } from "../../types";
import {
  findDockItemIndex,
  isSameItem,
  removeAncestorDuplicates,
  removeInactiveLoadingItems,
  reorderItemsWithActiveFirst,
  replaceActiveItem,
} from "../pipeline";

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

  const { displayItems, displayActiveIndex } = useMemo(() => {
    const registeredItems = dockItems || [];
    const registeredIndex = findDockItemIndex(
      registeredItems,
      activeItem ?? null,
      pathname,
    );
    const isHeldOutsideStack =
      registeredIndex === -1 && Boolean(activeItem?.isRoutePending);
    const items = isHeldOutsideStack
      ? [activeItem!, ...registeredItems]
      : registeredItems;
    const activeIndex = isHeldOutsideStack ? 0 : registeredIndex;
    const itemsWithActiveItem = replaceActiveItem(
      items,
      activeIndex,
      activeItem ?? null,
    );

    const reorderedItems = reorderItemsWithActiveFirst(
      itemsWithActiveItem,
      activeIndex,
    );
    const filteredItems = removeInactiveLoadingItems(
      reorderedItems,
      activeItem ?? null,
    );
    const deduplicatedItems = removeAncestorDuplicates(filteredItems);
    const activeIndexForDisplay = deduplicatedItems.findIndex((item) =>
      isSameItem(item, activeItem),
    );

    return {
      displayItems: deduplicatedItems,
      displayActiveIndex:
        activeIndexForDisplay !== -1
          ? activeIndexForDisplay
          : reorderedItems.length > 0
            ? 0
            : -1,
    };
  }, [pathname, dockItems, activeItem]);

  return {
    displayItems,
    activeIndex: displayActiveIndex,
  };
}
