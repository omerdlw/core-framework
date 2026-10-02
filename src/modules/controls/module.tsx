"use client";

import { useMemo } from "react";
import {
  defineModule,
  type PageConfig,
  type PageModuleApi,
} from "@/kernel";
import { useControls } from "./hooks";
import { normalizePageControls, validateControlEntry } from "./utils";
import { Controls } from "./overlay";
import {
  type ControlsPageApi,
  type DefinedControls,
  type DefineControlsOptions,
  type ControlsPageConfig,
  type PageControlEntry,
} from "./types";

function selectPageControls(config: PageConfig) {
  return normalizePageControls(config.controls);
}

function useControlsPage(
  _slice: PageControlEntry[] | null,
  page: PageModuleApi,
): ControlsPageApi {
  return useMemo(
    () => ({
      set: (controls: ControlsPageConfig | null) => page.set({ controls }),
    }),
    [page],
  );
}

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
