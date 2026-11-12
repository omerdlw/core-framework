"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { normalizePath, shallowEqual } from "@/foundation/utils";
import { useRequiredContext } from "@/react/hooks";

import { DOCK_ATTENTION_KIND } from "../../constants";
import { DockContext, useDockActions, useDockSelector } from "../../context";
import { useDockRouteReset } from "../../hooks/use-dock-route-reset";
import { useDockNavigation } from "../../routing/navigation";
import type { DockNavigateOptions } from "../../types";
import { useDockDisplay } from "../display";
import { useDockLayout } from "./use-dock-layout";

export function useDock() {
  const {
    closeSurface,
    setExpanded: setExpandedState,
    setDockHeight,
    setSearchQuery,
  } = useDockActions();
  const { isExpanded, searchQuery } = useDockSelector(
    (state) => ({
      isExpanded: state.expanded,
      searchQuery: state.searchQuery,
    }),
    shallowEqual,
  );

  const [isHovered, setIsHovered] = useState(false);
  const { guards } = useRequiredContext(DockContext, "useDock", "DockProvider");
  const core = useDockNavigation();

  const {
    activeTransaction,
    cancelDock,
    lastTransaction,
    locationKey,
    navigate: navigateWithGuards,
    pathname,
  } = core;

  const effectivePathname = activeTransaction?.to
    ? normalizePath(activeTransaction.to)
    : pathname;
  const display = useDockDisplay(effectivePathname, {
    isNavigating: Boolean(activeTransaction),
  });
  const { dockItems, activeItem, statusState, attention, topology } = display;
  const isHudModeActive =
    attention?.kind === DOCK_ATTENTION_KIND.HUD ||
    attention?.kind === DOCK_ATTENTION_KIND.OPERATION;
  const isSurfaceActive = Boolean(activeItem?.isSurface);
  const activeItemHasAction = Boolean(activeItem?.action);

  const clearHoverState = useCallback(() => setIsHovered(false), []);

  const setExpanded = useCallback(
    (nextValue: boolean | ((prev: boolean) => boolean)) => {
      const resolvedValue =
        typeof nextValue === "function" ? nextValue(isExpanded) : nextValue;
      if (isSurfaceActive && resolvedValue) return;
      setExpandedState(resolvedValue);
    },
    [isExpanded, isSurfaceActive, setExpandedState],
  );

  const wasSurfaceActiveRef = useRef(false);
  useEffect(() => {
    if (isSurfaceActive) {
      wasSurfaceActiveRef.current = true;
      return;
    }
    if (wasSurfaceActiveRef.current) {
      wasSurfaceActiveRef.current = false;
      clearHoverState();
    }
  }, [clearHoverState, isSurfaceActive]);

  useEffect(() => {
    if (isSurfaceActive && isExpanded) setExpandedState(false);
  }, [isExpanded, isSurfaceActive, setExpandedState]);

  const navigate = useCallback(
    async (href: string, options?: DockNavigateOptions) => {
      if (!href) return false;
      const isUnguarded = Boolean(options?.force) || guards.count() === 0;
      const navigationPromise = navigateWithGuards(href, options);
      if (isUnguarded) {
        setExpanded(false);
        setSearchQuery("");
        clearHoverState();
      }
      const didNavigate = await navigationPromise;
      if (!didNavigate) return didNavigate;
      if (!isUnguarded) {
        setExpanded(false);
        setSearchQuery("");
        clearHoverState();
      }
      return didNavigate;
    },
    [clearHoverState, guards, navigateWithGuards, setExpanded, setSearchQuery],
  );

  const { displayItems, activeIndex: layoutActiveIndex } = useDockLayout({
    dockItems,
    activeItem,
    pathname: effectivePathname,
  });

  useDockRouteReset(pathname, () => {
    setExpanded(false);
    setSearchQuery("");
    setIsHovered(false);
  });

  return {
    dockItems: displayItems,
    activeItem,
    activeIndex: layoutActiveIndex,
    statusState,
    attention,
    topology,
    dockTransaction: activeTransaction,
    lastDockTransaction: lastTransaction,
    navigate,
    locationKey,
    pathname,
    cancelDock,
    closeSurface,
    expanded: isExpanded,
    setExpanded,
    setDockHeight,
    setSearchQuery,
    isHovered,
    setIsHovered,
    searchQuery,
    activeItemHasAction,
    isHudActive: isHudModeActive,
  };
}
