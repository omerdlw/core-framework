import { normalizePath } from "@/foundation/utils";

import { toSearchableText } from "../../lib/element-helpers";
import { isPathPrefix, isSamePath } from "../../model/paths";
import type { DockItem } from "../../types";

export function isNotFoundItem(item: DockItem | null | undefined): boolean {
  return (
    item?.isNotFound || item?.path === "not-found" || item?.type === "NOT_FOUND"
  );
}

function flattenDockItems(items: DockItem[]): DockItem[] {
  return items.map((item) => ({
    ...item,
    activeChild: null,
    children: null,
    hasActiveChild: false,
    isExpanded: false,
    isParent: false,
  }));
}

function filterDockItems(items: DockItem[], searchQuery: string): DockItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return items;
  return items.filter(
    (item) =>
      toSearchableText(item.name).toLowerCase().includes(normalizedQuery) ||
      toSearchableText(item.title).toLowerCase().includes(normalizedQuery) ||
      toSearchableText(item.description)
        .toLowerCase()
        .includes(normalizedQuery),
  );
}

export function buildDockItems({
  rawItems,
  expanded,
  searchQuery,
  isNotFoundPage,
}: {
  rawItems: DockItem[];
  expanded?: boolean;
  searchQuery: string;
  isNotFoundPage: boolean;
}): DockItem[] {
  const baseItems = isNotFoundPage
    ? rawItems.filter((item) => item.path === "/" || isNotFoundItem(item))
    : rawItems;
  const flattenedItems = flattenDockItems(baseItems);
  if (expanded && searchQuery)
    return filterDockItems(flattenedItems, searchQuery);
  return flattenedItems;
}

export interface DockBaseMatch {
  item: DockItem | null;
  isFallback: boolean;
}

export function resolveBaseActiveItemMatch({
  rawItems,
  dockItems,
  pathname,
  isNotFoundPage,
}: {
  rawItems: DockItem[];
  dockItems: DockItem[];
  pathname: string;
  isNotFoundPage: boolean;
}): DockBaseMatch {
  const normalizedPathname = normalizePath(pathname);
  const matched = (item: DockItem | null): DockBaseMatch => ({
    item,
    isFallback: false,
  });

  const selectedDataSource = dockItems.find(
    (item) => item.isDataSource && item.isSelected,
  );
  if (selectedDataSource) return matched(selectedDataSource);

  if (isNotFoundPage)
    return matched(rawItems.find(isNotFoundItem) || rawItems[0] || null);

  const matchInDock = dockItems.find(
    (item) =>
      isSamePath(item.path, normalizedPathname) ||
      (item.targetPath && isSamePath(item.targetPath, normalizedPathname)),
  );
  if (matchInDock) return matched(matchInDock);

  const matchInRaw = rawItems.find(
    (item) =>
      isSamePath(item.path, normalizedPathname) ||
      (item.targetPath && isSamePath(item.targetPath, normalizedPathname)),
  );
  if (matchInRaw) return matched(matchInRaw);

  let prefixMatchedRawItem: DockItem | null = null;
  let longestPrefixLength = -1;
  for (let i = 0; i < rawItems.length; i++) {
    const candidatePath = normalizePath(rawItems[i]?.path);
    if (
      candidatePath.length > longestPrefixLength &&
      isPathPrefix(candidatePath, normalizedPathname)
    ) {
      prefixMatchedRawItem = rawItems[i];
      longestPrefixLength = candidatePath.length;
    }
  }

  if (prefixMatchedRawItem) {
    const item =
      dockItems.find(
        (entry) =>
          isSamePath(entry?.path, prefixMatchedRawItem?.path) ||
          (entry?.name && entry.name === prefixMatchedRawItem?.name),
      ) || prefixMatchedRawItem;
    return {
      item,
      isFallback: normalizePath(prefixMatchedRawItem.path) === "/",
    };
  }
  return { item: rawItems[0] || null, isFallback: true };
}

export function selectPendingRouteItem({
  match,
  heldItem,
  pathname,
  isHolding,
}: {
  match: DockBaseMatch;
  heldItem: DockItem | null;
  pathname: string;
  isHolding: boolean;
}): DockItem | null {
  if (!match.isFallback || !isHolding || !heldItem) return match.item;
  if (heldItem.path && isSamePath(heldItem.path, pathname)) return match.item;
  return heldItem;
}
