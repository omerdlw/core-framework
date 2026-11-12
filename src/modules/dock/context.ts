"use client";

import { type ComponentType, use } from "react";

import { getOrCreateGlobalContext } from "@/core/kernel";
import { createStore, shallowEqual } from "@/foundation/utils";
import {
  type LoadingActions,
  type LoadingStateWithPage,
  useOptionalLoadingActions,
  useOptionalLoadingState,
} from "@/modules/loading";
import {
  type MediaActions,
  type MediaState,
  useOptionalMediaActions,
  useOptionalMediaState,
} from "@/modules/media";
import { useNotificationVisible } from "@/modules/notification";
import { useRequiredContext, useStore } from "@/react/hooks";

import type {
  DockActions,
  DockContextValue,
  DockState,
  ErrorActionsProps,
  GuardActionsProps,
} from "./types";

export const DockContext = getOrCreateGlobalContext<DockContextValue | null>(
  "DockContext",
  null,
);

/** Subscribes to the whole dock state. Must be used under `DockProvider`. */
export function useDockState(): DockState {
  const { store } = useRequiredContext(
    DockContext,
    "useDockState",
    "DockProvider",
  );
  return useStore(store);
}

/** Subscribes to a slice of the dock state; re-renders only when the slice changes. */
export function useDockSelector<T>(
  selector: (state: DockState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const { store } = useRequiredContext(
    DockContext,
    "useDockSelector",
    "DockProvider",
  );
  return useStore(store, selector, isEqual);
}

/** Returns the dock actions. Must be used under `DockProvider`. */
export function useDockActions(): DockActions {
  return useRequiredContext(DockContext, "useDockActions", "DockProvider")
    .actions;
}

/** Current dock height plus a bottom padding style that reserves room for it. */
export function useDockHeight() {
  const dockHeight = useDockSelector((state) => state.dockHeight);
  return { dockHeight, padding: { paddingBottom: `${dockHeight}px` } };
}

export const EMPTY_DOCK_STATE: DockState = Object.freeze({
  activeItem: null,
  activeOperation: null,
  activeSurfaceEntry: null,
  activeSurfaceId: null,
  contextActions: [],
  dockContinuity: [],
  dockHeight: 0,
  dockReturnHandoffs: [],
  expanded: false,
  hud: null,
  hudEntries: [],
  isHudActive: false,
  isSurfaceOpen: false,
  locationKey: "",
  operations: [],
  pathname: "",
  searchQuery: "",
  selectionMode: null,
  surfaceLifecycle: "",
  surfacePhase: "",
  surfaceStack: [],
});

const NOOP_DOCK_STORE = createStore<DockState>(EMPTY_DOCK_STATE);

/** Like `useDockState` (or a selector), but returns an empty state outside `DockProvider`. */
export function useOptionalDockState(): DockState;
export function useOptionalDockState<T>(
  selector: (state: DockState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useOptionalDockState<T = DockState>(
  selector?: (state: DockState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const ctx = use(DockContext);
  return useStore(
    ctx?.store ?? NOOP_DOCK_STORE,
    selector as (state: DockState) => T,
    isEqual,
  );
}

/** Returns the dock actions, or null outside `DockProvider`. */
export function useOptionalDockActions(): DockActions | null {
  const ctx = use(DockContext);
  return ctx?.actions ?? null;
}

export type DockMediaView = MediaState;

export function useDockMedia(): DockMediaView {
  return useOptionalMediaState((state) => state, shallowEqual);
}

export function useDockHasMedia(): boolean {
  return useOptionalMediaState((state) => state.hasMedia);
}

export const useDockMediaActions: () => MediaActions = useOptionalMediaActions;

export function useDockLoadingState(): LoadingStateWithPage {
  return useOptionalLoadingState();
}

export const useDockLoadingActions: () => LoadingActions =
  useOptionalLoadingActions;

export const useDockNotificationVisible: () => boolean = useNotificationVisible;

export const statusActionDefaults: {
  error: ComponentType<ErrorActionsProps> | null;
  guard: ComponentType<GuardActionsProps> | null;
} = { error: null, guard: null };
