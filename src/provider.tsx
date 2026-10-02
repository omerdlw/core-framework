"use client";

import { useMemo, type JSX, type ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { GlobalError, GlobalErrorListener, ModuleError } from "@/error";
import {
  Compose,
  ModuleHost,
  type AnyCoreModule,
  type AppRegistryEntry,
  type ProviderEntry,
} from "@/kernel";

interface CoreTooltipConfig {
  delayDuration?: number;
  skipDelayDuration?: number;
}

interface CoreProviderSlots {
  afterContent?: ReactNode;
  beforeContent?: ReactNode;
  overlays?: ReactNode;
}

export interface CoreProviderProps {
  children: ReactNode;
  modules: readonly AnyCoreModule[];
  overlays?: ReactNode;
  providers?: readonly ProviderEntry[];
  registryEntries?: readonly AppRegistryEntry[];
  slots?: CoreProviderSlots;
  tooltip?: boolean | CoreTooltipConfig;
}

export function CoreProvider({
  children,
  modules,
  overlays,
  providers,
  registryEntries,
  slots,
  tooltip = true,
}: CoreProviderProps): JSX.Element {
  const tooltipConfig = useMemo(
    () =>
      tooltip === false
        ? null
        : {
            delayDuration:
              (typeof tooltip === "object" && tooltip.delayDuration) || 300,
            skipDelayDuration:
              (typeof tooltip === "object" && tooltip.skipDelayDuration) || 150,
          },
    [tooltip],
  );

  const providerPipeline = useMemo<readonly ProviderEntry[]>(
    () => [
      GlobalError,
      ...(tooltipConfig
        ? [[TooltipPrimitive.Provider, tooltipConfig] as const]
        : []),
      [ModuleHost, { boundary: ModuleError, modules, registryEntries }],
      ...(providers ?? []),
    ],
    [modules, providers, registryEntries, tooltipConfig],
  );

  return (
    <Compose providers={providerPipeline}>
      {slots?.beforeContent}
      {children}
      {slots?.afterContent}
      {overlays}
      {slots?.overlays}
      <GlobalErrorListener />
    </Compose>
  );
}
