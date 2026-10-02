"use client";

import { createContext, type ComponentType } from "react";
import { useRequiredContext, useStore } from "@/hooks";
import { definePeer, type ModuleStateOf } from "@/kernel";
import { createStore, shallowEqual } from "@/utils";
import {
  type DockActions,
  type DockContextValue,
  type DockState,
  type ErrorActionsProps,
  type GuardActionsProps,
} from "./types";
import { getOrCreateGlobalContext } from "@/kernel/context-registry";

export const DockContext = getOrCreateGlobalContext<DockContextValue | null>(
  "DockContext",
  null,
);

export function useDockState(): DockState {
  const { store } = useRequiredContext(
    DockContext,
    "useDockState",
    "DockProvider",
  );
  return useStore(store);
}

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

export function useDockActions(): DockActions {
  return useRequiredContext(DockContext, "useDockActions", "DockProvider")
    .actions;
}

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

export type DockMediaView = ModuleStateOf<"media">;

const mediaPeer = definePeer("media", {
  actions: Object.freeze({
    removeSource: () => {},
    setMuted: () => {},
    toggle: () => {},
    toggleLoop: () => {},
    upsertSource: () => {},
  }),
  store: createStore<ModuleStateOf<"media">>({
    audibleElement: null,
    element: null,
    hasMedia: false,
    isPlaying: false,
    kind: null,
    loop: false,
    sourceId: null,
  }),
});

export function useDockMedia(): DockMediaView {
  return mediaPeer.useState((state) => state, shallowEqual);
}

const selectHasMedia = (state: ModuleStateOf<"media">): boolean =>
  state.hasMedia;

export function useDockHasMedia(): boolean {
  return mediaPeer.useState(selectHasMedia);
}

export const useDockMediaActions = mediaPeer.useActions;

const loadingPeer = definePeer("loading", {
  actions: {
    setLoading: () => {},
    setSkeleton: () => {},
    startLoading: () => {},
    stopLoading: () => {},
    withLoading: async (task) => (typeof task === "function" ? task() : task),
  },
  store: createStore<ModuleStateOf<"loading">>({
    isLoading: false,
    isPageLoading: false,
    message: null,
    minDuration: 0,
    showOverlay: false,
    skeleton: null,
  }),
});

export function useDockLoadingState(): ModuleStateOf<"loading"> {
  return loadingPeer.useState((state) => state);
}

export const useDockLoadingActions = loadingPeer.useActions;

const notificationPeer = definePeer("notification", {
  actions: {
    dismissAllNotifications: () => {},
    dismissNotification: () => {},
    showNotification: () => null,
  },
  store: createStore<ModuleStateOf<"notification">>({ notifications: {} }),
});

export function useDockNotificationVisible(): boolean {
  return notificationPeer.useState(
    ({ notifications }) => Object.keys(notifications).length > 0,
  );
}

export const statusActionDefaults: {
  error: ComponentType<ErrorActionsProps> | null;
  guard: ComponentType<GuardActionsProps> | null;
} = { error: null, guard: null };
