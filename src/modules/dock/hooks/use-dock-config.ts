"use client";

import { use, useMemo } from "react";

import { createStore, shallowEqual } from "@/foundation/utils";
import { useStore } from "@/react/hooks";

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

/**
 * Registers a dock config (or just a title) for the page and returns the
 * dock state and actions, with safe no-ops outside a provider.
 */
export function useDockConfig(
  configOrTitle?: string | Record<string, unknown> | null,
  options?: Record<string, unknown>,
) {
  // The registry compares the config by content, so a new `{ title }` per
  // render is not a change.
  const normalizedConfig =
    typeof configOrTitle === "string"
      ? { title: configOrTitle }
      : configOrTitle || null;

  useDockRegistration(normalizedConfig, options);

  const dockContext = use(DockContext);
  const actions = dockContext?.actions;
  const state = useStore(
    dockContext?.store ?? EMPTY_DOCK_STATE_STORE,
    selectDockConfigState,
    shallowEqual,
  );

  // stable identity: part of the public hook contract
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
