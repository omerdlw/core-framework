"use client";

import { useMemo } from "react";
import {
  defineModule,
  type PageConfig,
  type PageModuleApi,
} from "@/kernel";
import { useOptionalBackgroundState } from "../background";
import { AmbientContext, AmbientProvider, useAmbientTheme } from "./context";
import { resolvePageAmbientTheme } from "./utils";
import {
  type AmbientDescriptor,
  type AmbientOverrides,
  type AmbientPageApi,
  type AmbientPageConfig,
  type AmbientPageSlice,
  type DefineAmbientOptions,
  type DefinedAmbient,
} from "./types";

const firstString = (...values: unknown[]): string | null =>
  (values.find((value) => typeof value === "string" && value) as string) ??
  null;

function selectPageAmbient(config: PageConfig): AmbientPageSlice {
  return {
    ambient: config.ambient,
    banner: firstString(config.dock?.banner, config.dock?.bannerUrl),
  };
}

function useAmbientPage(
  slice: AmbientPageSlice | null,
  page: PageModuleApi,
): AmbientPageApi {
  const posterUrl = useOptionalBackgroundState(
    (background) => background.posterUrl,
  );
  const theme = useMemo(
    () => resolvePageAmbientTheme(slice, posterUrl),
    [posterUrl, slice],
  );
  useAmbientTheme(theme);
  return useMemo(
    () => ({ set: (ambient: AmbientPageConfig) => page.set({ ambient }) }),
    [page],
  );
}

export const ambientModule = defineModule({
  id: "ambient",
  context: AmbientContext,
  Provider: AmbientProvider,
  uses: ["background"],
  page: {
    select: selectPageAmbient,
    use: useAmbientPage,
  },
});

declare module "@omerdlw/base-framework/kernel" {
  interface CoreModules {
    ambient: typeof ambientModule;
  }
  interface PageConfig {
    ambient?: AmbientPageConfig;
  }
}

function resolveValue<T, P>(value: T | ((props: P) => T), props: P): T {
  return typeof value === "function"
    ? (value as (props: P) => T)(props)
    : value;
}

export function defineAmbient(
  definition: DefineAmbientOptions = {},
): DefinedAmbient {
  const { defaultProps, id = "ambient-theme", ...config } = definition;

  const create = (
    props: Record<string, unknown> = {},
    { id: overrideId, ...overrides }: AmbientOverrides = {},
  ): AmbientDescriptor => {
    const mergedProps = { ...defaultProps, ...props };
    const merged = { ...config, ...overrides };

    return {
      ...merged,
      colors: resolveValue(merged.colors ?? null, mergedProps) ?? null,
      id: overrideId ?? id,
      image: resolveValue(merged.image ?? null, mergedProps),
      initialPalette: merged.initialPalette ?? null,
      options: { ...config.options, ...overrides.options },
      props: mergedProps,
      scope: merged.scope ?? null,
      transition: merged.transition ?? true,
    };
  };

  return Object.freeze({
    config: definition,
    create,
    id,
    use: function useDefinedAmbient(
      props?: Record<string, unknown>,
      overrides?: AmbientOverrides,
    ) {
      return useAmbientTheme(create(props, overrides));
    },
  });
}
