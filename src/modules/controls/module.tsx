"use client";

import { useMemo } from "react";

import {
  defineModule,
  type PageConfig,
  type PageModuleApi,
} from "@/core/kernel";

import { normalizePageControls, validateControlEntry } from "./entries";
import { useControls } from "./hooks";
import { Controls } from "./overlay";
import {
  type ControlsPageApi,
  type ControlsPageConfig,
  type DefineControlsOptions,
  type DefinedControls,
  type PageControlEntry,
} from "./types";

function selectPageControls(config: PageConfig) {
  return normalizePageControls(config.controls);
}

function useControlsPage(
  _slice: PageControlEntry[] | null,
  page: PageModuleApi,
): ControlsPageApi {
  // stable identity: part of the public hook contract
  return useMemo(
    () => ({
      set: (controls: ControlsPageConfig | null) => page.set({ controls }),
    }),
    [page],
  );
}

/**
 * Creates a reusable controls definition whose `use` hook registers it.
 */
export function defineControls(
  definition: DefineControlsOptions = {},
): DefinedControls {
  const { id = "controls", order = 0 } = definition;

  return Object.freeze({
    config: definition,
    id,
    order,
    use: function useDefinedControls(props = {}, options = {}) {
      return useControls(
        {
          ...definition,
          defaultProps: { ...definition.defaultProps, ...props },
        },
        options,
      );
    },
  });
}

/**
 * Module definition that renders controls beside the dock.
 */
export const controlsModule = defineModule({
  id: "controls",
  Overlay: Controls,
  registry: {
    keyPolicy: "named",
    lifecycle: "immediate",
    validate: validateControlEntry,
  },
  page: {
    select: selectPageControls,
    entries: (entry: PageControlEntry, { pathname }) => {
      const path = pathname || "/";
      return [{ key: `${path}::${entry.id}`, value: { ...entry, path } }];
    },
    use: useControlsPage,
  },
});

declare module "@omerdlw/base-framework/kernel" {
  interface CoreModules {
    controls: typeof controlsModule;
  }
  interface PageConfig {
    controls?: ControlsPageConfig | null;
  }
}
