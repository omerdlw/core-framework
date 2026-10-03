import { normalizePath } from "@/utils";
import { isInlineActionPathMatch, isPathPrefix, isSamePath } from "../paths";
import { type DockItem } from "../types";

type AncestorAwareItem = DockItem & {
  keepWhenDescendant?:
    boolean | ((activePath: string, item: DockItem) => boolean);
  statusType?: string;
};

export function isSameDockItem(
  item: DockItem | null | undefined,
  candidate: DockItem | null | undefined,
): boolean {
  return Boolean(
    (item?.path && item.path === candidate?.path) ||
    (item?.name && item.name === candidate?.name),
  );
}

export const isSameItem = isSameDockItem;

export function getItemKey(link: DockItem | null, index = 0): string {
  const identity = link?.id ?? link?.path ?? link?.name ?? link?.type;
  return `dock-card:${identity == null ? `slot-${index}` : String(identity)}`;
}

export function resolveDockHeaderKey({
  link,
  description = "",
  showVideoIcon = false,
}: {
  link: AncestorAwareItem;
  description?: string | null;
  showVideoIcon?: boolean;
}): string {
  const statusPart = link?.isStatus
    ? `status:${link.statusType || link.type || "status"}`
    : "standard";
  const identityPart = link?.path || link?.name || link?.id || "item";
  const titlePart = link?.title || link?.name || "";
  const descPart = description || "";
  const iconPart = showVideoIcon ? "video" : link?.icon || "no-icon";
  return `${statusPart}:${identityPart}:${iconPart}:${titlePart}:${descPart}`;
}

export function findDockItemIndex(
  dockItems: DockItem[],
  activeItem: DockItem | null,
  pathname: string,
): number {
  const normalizedPathname = normalizePath(pathname);
  const selectedDataSourceIndex = dockItems.findIndex(
    (item) => item.isDataSource && item.isSelected,
  );
  if (selectedDataSourceIndex !== -1) return selectedDataSourceIndex;

  if (activeItem) {
    const matchedActiveIndex = dockItems.findIndex(
      (item) =>
        (item.path && isSamePath(item.path, activeItem.path)) ||
        (item.name && item.name === activeItem.name),
    );
    if (matchedActiveIndex !== -1) return matchedActiveIndex;
  }

  return dockItems.findIndex(
    (item) =>
      isSamePath(item.path, normalizedPathname) ||
      (item.targetPath && isSamePath(item.targetPath, normalizedPathname)),
  );
}

export function resolveActiveIndex({
  dockItems,
  activeItem,
  pathname,
}: {
  dockItems: DockItem[];
  activeItem: DockItem | null;
  pathname: string;
}): number {
  return Math.max(0, findDockItemIndex(dockItems, activeItem, pathname));
}

function shouldKeepAncestorItem(
  item: AncestorAwareItem,
  activePath: string,
): boolean {
  const policy = item?.keepWhenDescendant;
  if (typeof policy === "function") {
    try {
      return Boolean(policy(activePath, item));
    } catch {
      return false;
    }
  }
  return policy === true;
}

function isAncestorPath(item: AncestorAwareItem, activePath: string): boolean {
  const candidatePath = item?.path;
  if (!candidatePath || candidatePath === "/" || candidatePath === activePath) {
    return false;
  }
  return (
    isPathPrefix(candidatePath, activePath) &&
    !shouldKeepAncestorItem(item, activePath)
  );
}

export function removeAncestorDuplicates(items: DockItem[] = []): DockItem[] {
  if (!Array.isArray(items) || items.length <= 1) return items;
  const activePath = items[0]?.path;
  if (!activePath) return items;

  return items.filter(
    (item, index) => index === 0 || !isAncestorPath(item, activePath),
  );
}

export function replaceActiveItem(
  items: DockItem[],
  activeIndex: number,
  activeItem: DockItem | null,
): DockItem[] {
  if (activeIndex === -1 || !activeItem) return items;
  const nextItems = [...items];
  nextItems[activeIndex] = activeItem;
  return nextItems;
}

export function removeInactiveLoadingItems(
  items: DockItem[] = [],
  activeItem: DockItem | null = null,
): DockItem[] {
  if (!Array.isArray(items) || items.length === 0) return items;
  return items.filter(
    (item) => !item?.isLoading || isSameItem(item, activeItem),
  );
}

export function reorderItemsWithActiveFirst(
  items: DockItem[],
  activeIndex: number,
): DockItem[] {
  if (activeIndex === -1) return items;
  const active = items[activeIndex];
  const rest = [
    ...items.slice(0, activeIndex),
    ...items.slice(activeIndex + 1),
  ];
  rest.sort((a, b) => (a.path === "/" ? 1 : b.path === "/" ? -1 : 0));
  return [active, ...rest];
}

export function shouldRenderInlineAction(
  {
    action,
    isLoading,
    isOverlay,
    path,
  }: {
    action?: unknown;
    isLoading?: boolean;
    isOverlay?: boolean;
    path?: string | null;
  },
  pathname: string,
): boolean {
  return (
    Boolean(action) &&
    !isLoading &&
    (isOverlay || !path || isInlineActionPathMatch(path, pathname))
  );
}

export function getIsItemActive(
  link: DockItem | null,
  activeItem: DockItem | null,
): boolean {
  if (!link || !activeItem) return false;
  if (link.path && activeItem.path && isSamePath(link.path, activeItem.path))
    return true;
  if (
    link.targetPath &&
    activeItem.targetPath &&
    isSamePath(link.targetPath, activeItem.targetPath)
  )
    return true;
  return Boolean(link.name && activeItem.name && link.name === activeItem.name);
}
