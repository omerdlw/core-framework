"use client";

import { use, useMemo } from "react";
import { useStore } from "@/react/hooks";
import { createStore, shallowEqual } from "@/foundation/utils";
import { DockContext, EMPTY_DOCK_STATE } from "../context";
import type { DockState } from "../types";
import { useDockRegistration } from "./use-dock-registration";

const EMPTY_DOCK_STATE_STORE = createStore<DockState>(EMPTY_DOCK_STATE);

function selectDockConfigState(state: DockState) {
  return {
    activeItem: state.activeItem,
    dockHeight: state.dockHeight,
    expanded: state.expanded,
    pathname: state.pathname,
  };
}

export function useDockConfig(
  configOrTitle?: string | Record<string, unknown> | null,
  options?: Record<string, unknown>,
) {
  const normalizedConfig = useMemo(() => {
    if (!configOrTitle) return null;
    if (typeof configOrTitle === "string") return { title: configOrTitle };
    return configOrTitle;
  }, [configOrTitle]);

  useDockRegistration(normalizedConfig, options);

  const dockContext = use(DockContext);
  const actions = dockContext?.actions;
  const state = useStore(
    dockContext?.store ?? EMPTY_DOCK_STATE_STORE,
    selectDockConfigState,
    shallowEqual,
  );

  return useMemo(
    () => ({
      activeItem: state.activeItem,
      clearHud: actions?.clearHud ?? (() => {}),
      closeAllSurfaces: actions?.closeAllSurfaces ?? (() => {}),
      closeSurface: actions?.closeSurface ?? (() => {}),
      expanded: state.expanded,
      dockHeight: state.dockHeight,
      navigate: actions?.navigate ?? (() => Promise.resolve(false)),
      openSurface: actions?.openSurface ?? (() => undefined),
      pathname: state.pathname,
      setExpanded: actions?.setExpanded ?? (() => {}),
      setHud: actions?.setHud ?? (() => {}),
      setSearchQuery: actions?.setSearchQuery ?? (() => {}),
    }),
    [actions, state],
  );
}
