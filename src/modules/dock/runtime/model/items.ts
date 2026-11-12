import { normalizePath } from "@/foundation/utils";

import { toSearchableText } from "../../lib/element-helpers";
import { isPathPrefix, isSamePath } from "../../model/paths";
import type { DockItem } from "../../types";

const ROOT_PATH = "/";
const NOT_FOUND_PATH = "not-found";
const NOT_FOUND_TYPE = "NOT_FOUND";

/** True for the dock item that represents the not-found page. */
export function isNotFoundItem(item: DockItem | null | undefined): boolean {
  return (
    item?.isNotFound ||
    item?.path === NOT_FOUND_PATH ||
    item?.type === NOT_FOUND_TYPE
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
    ? rawItems.filter((item) => item.path === ROOT_PATH || isNotFoundItem(item))
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

const NO_PREFIX_LENGTH = -1;

function findItemByPath(items: DockItem[], normalizedPathname: string) {
  return items.find(
    (item) =>
      isSamePath(item.path, normalizedPathname) ||
      (item.targetPath && isSamePath(item.targetPath, normalizedPathname)),
  );
}

function findLongestPrefixItem(
  rawItems: DockItem[],
  normalizedPathname: string,
): DockItem | null {
  let prefixMatchedRawItem: DockItem | null = null;
  let longestPrefixLength = NO_PREFIX_LENGTH;
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
  return prefixMatchedRawItem;
}

function resolvePrefixMatch(
  prefixMatchedRawItem: DockItem,
  dockItems: DockItem[],
): DockBaseMatch {
  const item =
    dockItems.find(
      (entry) =>
        isSamePath(entry?.path, prefixMatchedRawItem.path) ||
        (entry?.name && entry.name === prefixMatchedRawItem.name),
    ) || prefixMatchedRawItem;
  return {
    item,
    isFallback: normalizePath(prefixMatchedRawItem.path) === ROOT_PATH,
  };
}

/**
 * Finds the dock item for a pathname: selected data source, exact match,
 * then the longest path prefix. `isFallback` marks a match that is only the
 * root or first item.
 */
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

  const matchInDock = findItemByPath(dockItems, normalizedPathname);
  if (matchInDock) return matched(matchInDock);

  const matchInRaw = findItemByPath(rawItems, normalizedPathname);
  if (matchInRaw) return matched(matchInRaw);

  const prefixMatchedRawItem = findLongestPrefixItem(
    rawItems,
    normalizedPathname,
  );
  if (prefixMatchedRawItem)
    return resolvePrefixMatch(prefixMatchedRawItem, dockItems);
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
