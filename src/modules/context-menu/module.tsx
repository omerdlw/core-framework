"use client";

import { useMemo } from "react";
import {
  defineModule,
  type PageConfig,
  type PageModuleApi,
} from "@/kernel";
import { CURRENT_PAGE_KEY, GLOBAL_MENU_KEY } from "./constants";
import {
  ContextMenuContext,
  ContextMenuProvider,
  useContextMenu,
  useContextMenuActions,
} from "./context";
import { ContextMenuGlobal } from "./overlay";
import {
  type ContextMenuConfig,
  type ContextMenuDefinition,
  type ContextMenuPageApi,
  type ContextMenuPageConfig,
} from "./types";

function selectPageContextMenu(
  config: PageConfig,
): ContextMenuPageConfig | null {
  return config.contextMenu ?? null;
}

function useContextMenuPage(
  _slice: ContextMenuPageConfig | null,
  page: PageModuleApi,
): ContextMenuPageApi {
  const actions = useContextMenuActions();
  return useMemo(
    () => ({
      ...actions,
      set: (contextMenu: ContextMenuPageConfig | null) =>
        page.set({ contextMenu }),
    }),
    [actions, page],
  );
}

export const contextMenuModule = defineModule({
  id: "contextMenu",
  context: ContextMenuContext,
  Provider: ContextMenuProvider,
  uses: ["dock"],
  Overlay: ContextMenuGlobal,
  registry: {
    cleanupDelayMs: 600,
    keyPolicy: "route",
    lifecycle: "immediate",
    reservedKeys: [CURRENT_PAGE_KEY, GLOBAL_MENU_KEY],
  },
  page: {
    select: selectPageContextMenu,
    entries: (slice: ContextMenuPageConfig, { pathname }) => [
      { key: pathname || CURRENT_PAGE_KEY, value: slice },
    ],
    use: useContextMenuPage,
  },
});

declare module "@omerdlw/base-framework/kernel" {
  interface CoreModules {
    contextMenu: typeof contextMenuModule;
  }
  interface PageConfig {
    contextMenu?: ContextMenuPageConfig | null;
  }
}

export function defineContextMenu(
  definition: Partial<ContextMenuConfig> = {},
): ContextMenuDefinition {
  return Object.freeze({
    config: definition,
    id: definition.id ?? "context-menu",
    use: function useDefinedContextMenu(options = {}) {
      return useContextMenu({ ...definition, ...options });
    },
  });
}
