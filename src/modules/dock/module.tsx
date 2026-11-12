"use client";

import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";

import { defineModule, type PageModuleApi } from "@/core/kernel";

import { Dock } from "./components/dock";
import {
  ErrorActions,
  GuardActions,
  NotFoundActions,
} from "./components/status-actions";
import { DockContext, statusActionDefaults, useDockActions } from "./context";
import {
  mergeDockEntries,
  selectPageDock,
  toDockEntries,
  validateDockEntry,
} from "./model/page-entry";
import { openPageSurface } from "./model/page-surface";
import { DockProvider } from "./provider";
import { useDockGuard } from "./routing/guards";
import { useDockContextActions } from "./runtime/commands";
import type {
  DockPageApi,
  DockPageConfig,
  DockPageGuard,
  DockSlotContent,
  DockStatusTheme,
  DockSurfaceSlot,
} from "./types";

const REGISTRY_CLEANUP_DELAY_MS = 600;
const NO_GUARD: DockPageGuard = Object.freeze({ when: false });
// Object.freeze narrows the empty array to readonly never[]; the config type is mutable.
const NO_ACTIONS: NonNullable<DockPageConfig["actions"]> = Object.freeze(
  [],
) as unknown as NonNullable<DockPageConfig["actions"]>;

function useDockPage(
  slice: DockPageConfig | null,
  page: PageModuleApi,
): DockPageApi {
  const actions = useDockActions();
  useDockGuard(slice?.guard ?? NO_GUARD);
  useDockContextActions(slice?.actions ?? NO_ACTIONS);

  const surfacesRef = useRef(slice?.surfaces);
  useLayoutEffect(() => {
    surfacesRef.current = slice?.surfaces;
  }, [slice?.surfaces]);

  // stable identity: part of the public hook contract
  return useMemo(
    () => ({
      ...actions,
      set: (dock: DockPageConfig) => page.set({ dock }),
      surface: (
        surface: DockSurfaceSlot | string,
        props: Record<string, unknown> = {},
      ) =>
        openPageSurface(
          typeof surface === "string"
            ? surfacesRef.current?.[surface]
            : surface,
          props,
          actions.openSurface,
        ),
    }),
    [actions, page],
  );
}

statusActionDefaults.error = ErrorActions;
statusActionDefaults.guard = GuardActions;

function DockModuleProvider({ children }: { children?: ReactNode }) {
  return (
    <DockProvider notFoundAction={NotFoundActions}>{children}</DockProvider>
  );
}

/**
 * The dock module: registers the dock overlay, its provider and the page
 * `dock` config with the framework kernel.
 */
export const dockModule = defineModule({
  id: "dock",
  context: DockContext,
  Provider: DockModuleProvider,
  Overlay: Dock,
  uses: ["loading", "media", "navigation", "notification"],
  registry: {
    cleanupDelayMs: REGISTRY_CLEANUP_DELAY_MS,
    keyPolicy: "path",
    lifecycle: "route",
    merge: mergeDockEntries,
    validate: validateDockEntry,
  },
  page: {
    select: selectPageDock,
    entries: toDockEntries,
    use: useDockPage,
  },
});

declare module "@omerdlw/base-framework/events" {
  interface FrameworkEventMap {
    DOCK_NAVIGATE: {
      from: string;
      item?: unknown;
      to: string;
      [key: string]: unknown;
    };
    DOCK_NOT_FOUND: {
      clear?: boolean;
      description?: string;
      icon?: ReactNode;
      path: string;
      title?: string;
      [key: string]: unknown;
    };
    DOCK_STATUS_SET: {
      action?: DockSlotContent | null;
      actions?: DockSlotContent | null;
      description?: string;
      duration?: number | null;
      flow?: string | null;
      icon?: ReactNode;
      isOverlay?: boolean;
      persist?: boolean;
      priority?: number | string | null;
      style?: DockStatusTheme;
      themeType?: string;
      title?: string;
      type?: string;
      [key: string]: unknown;
    };
    DOCK_STATUS_CLEAR: {
      flow?: string | null;
      type?: string;
      [key: string]: unknown;
    };
    DOCK_GUARD: {
      cancelText?: string;
      clear?: boolean;
      confirmText?: string;
      from?: string;
      icon?: ReactNode;
      message?: string;
      onCancel?: () => void;
      onConfirm?: () => void;
      title?: string;
      to?: string;
      when?: boolean;
      [key: string]: unknown;
    };
  }
}

declare module "@omerdlw/base-framework/kernel" {
  interface CoreModules {
    dock: typeof dockModule;
  }
  interface PageConfig {
    dock?: DockPageConfig | null;
  }
}
