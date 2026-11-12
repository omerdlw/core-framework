import type { Dispatch, SetStateAction } from "react";

import { DOCK_SURFACE_PHASE } from "../../constants";
import type { DockCardItemProps, DockItem } from "../../types";
import { getIsItemActive, getItemKey } from "../pipeline";

/** Focus index meaning that no card is focused. */
export const NO_FOCUSED_INDEX = -1;

/** Result of `dismissSurfaceFromOutside` when it closed or blocked a surface. */
export const OUTSIDE_DISMISS_HANDLED = "handled";
const OUTSIDE_DISMISS_UNHANDLED = "unhandled";

const ACTIVE_KEY_FALLBACK = "active";
const DEFAULT_ROUTE_KEY = "default";

/** Key that changes whenever the content the dock shows is replaced. */
export function resolveDockContentKey(
  activeItem: DockItem | null | undefined,
  isHudActive: boolean,
  hud: DockCardItemProps["hud"],
): string {
  if (activeItem?.isSurface)
    return `surface:${activeItem.surfaceId ?? activeItem.path ?? ACTIVE_KEY_FALLBACK}`;
  if (isHudActive) return `hud:${hud?.id || ACTIVE_KEY_FALLBACK}`;
  return `route:${activeItem?.path || activeItem?.name || DEFAULT_ROUTE_KEY}`;
}

/**
 * Handles a click outside the dock for an open surface: closes it, or keeps
 * it open when it is not dismissible.
 */
export function dismissSurfaceFromOutside(
  activeItem: DockItem | null | undefined,
) {
  if (!activeItem?.isSurface) return OUTSIDE_DISMISS_UNHANDLED;
  if (activeItem.dismissible === false) return OUTSIDE_DISMISS_HANDLED;
  if (typeof activeItem.closeAllSurfaces === "function") {
    activeItem.closeAllSurfaces();
    return OUTSIDE_DISMISS_HANDLED;
  }
  if (typeof activeItem.closeSurface === "function") {
    activeItem.closeSurface();
    return OUTSIDE_DISMISS_HANDLED;
  }
  return OUTSIDE_DISMISS_UNHANDLED;
}

interface DockCardPropsInput {
  activeItem: DockItem | null;
  clearHoverState: () => void;
  clearHud: DockCardItemProps["clearHud"];
  contextActions: DockCardItemProps["contextCommands"];
  dockItems: DockItem[];
  expanded: boolean;
  handleContentHeightChange: NonNullable<
    DockCardItemProps["onContentHeightChange"]
  >;
  hud: DockCardItemProps["hud"];
  isExtensionsVisible: boolean;
  isHudActive: boolean;
  isStackHovered: boolean;
  isStatusActive: boolean;
  navigate: (href: string, options?: { item?: DockItem | null }) => unknown;
  setExpanded: (expanded: boolean) => void;
  setFocusedIndex: Dispatch<SetStateAction<number>>;
  setIsHovered: (hovered: boolean) => void;
  setIsStackHovered: Dispatch<SetStateAction<boolean>>;
  statusStyle: DockCardItemProps["statusStyle"];
}

interface CardHandlersInput extends Pick<
  DockCardPropsInput,
  | "clearHoverState"
  | "expanded"
  | "isStatusActive"
  | "navigate"
  | "setExpanded"
  | "setFocusedIndex"
  | "setIsHovered"
  | "setIsStackHovered"
> {
  canTopCardPreview: boolean;
  isTop: boolean;
  item: DockItem;
  position: number;
}

function createCardHandlers({
  canTopCardPreview,
  clearHoverState,
  expanded,
  isStatusActive,
  isTop,
  item,
  navigate,
  position,
  setExpanded,
  setFocusedIndex,
  setIsHovered,
  setIsStackHovered,
}: CardHandlersInput) {
  const handleMouseEnter = () => {
    if (expanded) setFocusedIndex(position);
    if (!isTop || !canTopCardPreview) return;
    setIsStackHovered(true);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (expanded) setFocusedIndex(NO_FOCUSED_INDEX);
    if (!isTop || !canTopCardPreview) return;
    setIsStackHovered(false);
    setIsHovered(false);
  };

  const handleClick = () => {
    if (item.isOverlay || isStatusActive || item.isStatus) return;
    if (!expanded) {
      clearHoverState();
      setExpanded(true);
      return;
    }
    const targetPath = item.targetPath || item.path;
    if (targetPath)
      void navigate(targetPath, {
        item,
      });
  };

  return { handleClick, handleMouseEnter, handleMouseLeave };
}

/**
 * Builds the props of every dock card, ordered by key, with the hover, focus
 * and click handlers wired to the given setters.
 */
export function createDockCardProps({
  activeItem,
  clearHoverState,
  clearHud,
  contextActions,
  dockItems,
  expanded,
  handleContentHeightChange,
  hud,
  isExtensionsVisible,
  isHudActive,
  isStackHovered,
  isStatusActive,
  navigate,
  setExpanded,
  setFocusedIndex,
  setIsHovered,
  setIsStackHovered,
  statusStyle,
}: DockCardPropsInput) {
  const positionedDockItems = dockItems
    .map((item, index) => ({
      item,
      key: getItemKey(item, index),
      position: index,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));

  return positionedDockItems.map(({ item, key, position }) => {
    const isTop = position === 0;
    const isActive = getIsItemActive(item, activeItem);
    const canTopCardPreview = !isStatusActive;

    const { handleClick, handleMouseEnter, handleMouseLeave } =
      createCardHandlers({
        canTopCardPreview,
        clearHoverState,
        expanded,
        isStatusActive,
        isTop,
        item,
        navigate,
        position,
        setExpanded,
        setFocusedIndex,
        setIsHovered,
        setIsStackHovered,
      });

    return {
      key,
      item,
      link: item,
      activeItem,
      expanded,
      position,
      isTop,
      isActive,
      isStackHovered,
      hasExtensions: isExtensionsVisible,
      isSurfaceActive: Boolean(
        activeItem?.isSurface &&
        activeItem?.surfacePhase !== DOCK_SURFACE_PHASE.RESTORING_HEADER,
      ),
      statusStyle,
      isStatusActive,
      isHudActive,
      hud,
      clearHud,
      contextCommands: contextActions,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onClick: handleClick,
      onContentHeightChange: isTop ? handleContentHeightChange : null,
    };
  });
}
