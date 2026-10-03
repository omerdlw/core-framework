"use client";

import { useMemo, use, type ComponentType } from "react";
import { useRegistryEntries } from "@/kernel";
import {
  normalizePath,
  shallowEqual as areShallowCollectionsEqual,
} from "@/utils";
import { usePathname } from "next/navigation";
import { toSearchableText } from "../helpers";
import { isPathPrefix, isSamePath } from "../paths";
import { resolveActiveIndex } from "./pipeline";
import { useModuleTheme } from "@/theme";
import { DOCK_ATTENTION_KIND, dockTheme } from "../constants";
import { createInlineSurfaceEntry } from "../surface/definition";
import { applySurfaceToDockItem } from "../surface/view-model";
import { applyStatusOverlay } from "../status/model";
import { applyMediaAction } from "../cards";
import {
  type DockAttention,
  type DockItem,
  type DockStatusDescriptor,
  type SurfaceState,
  type SurfaceViewModelOptions,
} from "../types";
import {
  useDockHasMedia,
  useDockMediaActions,
  useDockLoadingState as useLoadingState,
  DockContext,
  useDockActions,
  useDockSelector,
} from "../context";
import { resolveDockAttention } from "../state";
import { createDockTopology } from "../routing/navigation";
import { useDockStatus } from "../status/hooks";

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

function resolveBaseActiveItem({
  rawItems,
  dockItems,
  pathname,
  isNotFoundPage,
}: {
  rawItems: DockItem[];
  dockItems: DockItem[];
  pathname: string;
  isNotFoundPage: boolean;
}): DockItem | null {
  const normalizedPathname = normalizePath(pathname);

  const selectedDataSource = dockItems.find(
    (item) => item.isDataSource && item.isSelected,
  );
  if (selectedDataSource) return selectedDataSource;

  if (isNotFoundPage)
    return rawItems.find(isNotFoundItem) || rawItems[0] || null;

  const matchInDock = dockItems.find(
    (item) =>
      isSamePath(item.path, normalizedPathname) ||
      (item.targetPath && isSamePath(item.targetPath, normalizedPathname)),
  );
  if (matchInDock) return matchInDock;

  const matchInRaw = rawItems.find(
    (item) =>
      isSamePath(item.path, normalizedPathname) ||
      (item.targetPath && isSamePath(item.targetPath, normalizedPathname)),
  );
  if (matchInRaw) return matchInRaw;

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
    return (
      dockItems.find(
        (entry) =>
          isSamePath(entry?.path, prefixMatchedRawItem?.path) ||
          (entry?.name && entry.name === prefixMatchedRawItem?.name),
      ) || prefixMatchedRawItem
    );
  }
  return rawItems[0] || null;
}

export function resolveActiveItem({
  rawItems,
  dockItems,
  pathname,
  isNotFoundPage,
  surfaceState,
  statusState,
  hasMedia,
  toggleMedia,
  mediaAction,
  actionStackClass,
  surfaceActions,
  isPageLoading,
  attention,
}: {
  rawItems: DockItem[];
  dockItems: DockItem[];
  pathname: string;
  isNotFoundPage: boolean;
  surfaceState: SurfaceState;
  statusState: DockStatusDescriptor | null;
  hasMedia: boolean;
  toggleMedia: () => void;
  mediaAction: ComponentType | null;
  actionStackClass: string;
  surfaceActions: SurfaceViewModelOptions;
  isPageLoading: boolean;
  attention: DockAttention;
}): DockItem | null {
  const baseActiveItem = resolveBaseActiveItem({
    rawItems,
    dockItems,
    pathname,
    isNotFoundPage,
  });
  if (!baseActiveItem) return null;

  if (attention?.kind === DOCK_ATTENTION_KIND.SURFACE)
    return applySurfaceToDockItem(
      baseActiveItem,
      surfaceState.activeSurfaceEntry,
      {
        ...surfaceActions,
        surfacePhase: surfaceState.surfacePhase,
        surfaceStack: surfaceState.surfaceStack,
      },
    );
  if (attention?.kind === DOCK_ATTENTION_KIND.STATUS && statusState?.isOverlay)
    return applyStatusOverlay(baseActiveItem, statusState);
  if (
    attention?.kind === DOCK_ATTENTION_KIND.HUD ||
    attention?.kind === DOCK_ATTENTION_KIND.OPERATION
  )
    return baseActiveItem;
  if (attention?.kind === DOCK_ATTENTION_KIND.STATUS && statusState)
    return applyStatusOverlay(baseActiveItem, statusState);

  const itemWithMediaAction = applyMediaAction(
    baseActiveItem,
    hasMedia,
    toggleMedia,
    mediaAction,
    actionStackClass,
  );
  const inlineSurface = createInlineSurfaceEntry(itemWithMediaAction?.surface);

  if (inlineSurface)
    return applySurfaceToDockItem(
      itemWithMediaAction,
      inlineSurface,
      surfaceActions,
    );
  return itemWithMediaAction;
}

function stripChildrenSystemFields(item: DockItem): DockItem {
  return {
    ...item,
    activeChild: null,
    children: null,
    hasActiveChild: false,
    isExpanded: false,
    isParent: false,
  };
}

export function useDockItems(): { rawItems: DockItem[] } {
  const entries = useRegistryEntries<"dock", DockItem>("dock");
  const rawItems = useMemo(
    () => Object.values(entries).map(stripChildrenSystemFields),
    [entries],
  );
  return { rawItems };
}

export function useDockDisplay(overridePathname?: string) {
  const routerPathname = usePathname();
  const pathname = overridePathname || routerPathname;
  const loadingState = useLoadingState();
  const isPageLoading = Boolean(loadingState?.isLoading);
  const { rawItems } = useDockItems();

  const {
    closeAllSurfaces,
    goBackSurface,
    closeSurface,
    pushStep,
    popStep,
    goToStep,
    getSurfaceFlow,
  } = useDockActions();

  const {
    expanded,
    searchQuery,
    activeSurfaceId,
    activeSurfaceEntry,
    activeOperation,
    hud,
    isSurfaceOpen,
    surfaceStack,
    surfacePhase,
  } = useDockSelector(
    (state) => ({
      activeOperation: state.activeOperation,
      activeSurfaceEntry: state.activeSurfaceEntry,
      activeSurfaceId: state.activeSurfaceId,
      expanded: state.expanded,
      hud: state.hud,
      isSurfaceOpen: state.isSurfaceOpen,
      searchQuery: state.searchQuery,
      surfacePhase: state.surfacePhase,
      surfaceStack: state.surfaceStack,
    }),
    areShallowCollectionsEqual,
  );

  const surfaceState = useMemo(
    () => ({
      activeSurfaceId,
      activeSurfaceEntry,
      isSurfaceOpen,
      surfaceStack,
      surfacePhase,
    }),
    [
      activeSurfaceId,
      activeSurfaceEntry,
      isSurfaceOpen,
      surfaceStack,
      surfacePhase,
    ],
  );

  const dockCtx = use(DockContext);
  const mediaAction = dockCtx?.runtimeActions?.mediaAction ?? null;
  const notFoundAction = dockCtx?.runtimeActions?.notFoundAction ?? null;
  const statusState = useDockStatus({ notFoundAction });
  const hasMedia = useDockHasMedia();
  const actionStackClass = useModuleTheme(dockTheme).slots.actionStack;
  const { toggle: toggleMedia } = useDockMediaActions();

  const attention = useMemo(
    () =>
      resolveDockAttention({
        hud,
        isPageLoading,
        operation: activeOperation,
        status: statusState,
        surface: surfaceState,
      }),
    [activeOperation, hud, isPageLoading, statusState, surfaceState],
  );

  const isNotFoundPage = useMemo(
    () => rawItems.some(isNotFoundItem),
    [rawItems],
  );

  const dockItems = useMemo(
    () => buildDockItems({ rawItems, expanded, searchQuery, isNotFoundPage }),
    [rawItems, expanded, searchQuery, isNotFoundPage],
  );

  const activeItem = useMemo(
    () =>
      resolveActiveItem({
        rawItems,
        dockItems,
        pathname,
        isNotFoundPage,
        surfaceState,
        statusState,
        hasMedia,
        toggleMedia,
        mediaAction,
        actionStackClass,
        surfaceActions: {
          closeSurface,
          closeAllSurfaces,
          goBackSurface,
          pushStep,
          popStep,
          goToStep,
          getSurfaceFlow,
          surfaceStack,
        },
        isPageLoading,
        attention,
      }),
    [
      rawItems,
      dockItems,
      pathname,
      isNotFoundPage,
      surfaceState,
      statusState,
      hasMedia,
      toggleMedia,
      mediaAction,
      actionStackClass,
      closeSurface,
      closeAllSurfaces,
      goBackSurface,
      pushStep,
      popStep,
      goToStep,
      getSurfaceFlow,
      surfaceStack,
      isPageLoading,
      attention,
    ],
  );

  const activeIndex = useMemo(
    () => resolveActiveIndex({ dockItems, activeItem, pathname }),
    [dockItems, activeItem, pathname],
  );

  const topology = useMemo(
    () => createDockTopology(dockItems, { pathname }),
    [dockItems, pathname],
  );

  return useMemo(
    () => ({
      dockItems,
      activeItem,
      activeIndex,
      statusState,
      attention,
      topology,
    }),
    [dockItems, activeItem, activeIndex, statusState, attention, topology],
  );
}
