"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { type JSX, type ReactNode, useMemo } from "react";

import { GlobalError, GlobalErrorListener, ModuleError } from "@/core/error";
import {
  type AnyCoreModule,
  type AppRegistryEntry,
  Compose,
  ModuleHost,
  type ProviderEntry,
} from "@/core/kernel";
import { ModuleMotionConfig } from "@/react/theme";

const DEFAULT_TOOLTIP_DELAY = 300;
const DEFAULT_TOOLTIP_SKIP_DELAY = 150;

interface CoreTooltipConfig {
  delayDuration?: number;
  skipDelayDuration?: number;
}

interface CoreProviderSlots {
  afterContent?: ReactNode;
  beforeContent?: ReactNode;
  overlays?: ReactNode;
}

interface ModuleBoundaryProps {
  children?: ReactNode;
  name?: string;
}

function ModuleBoundary({ children, name }: ModuleBoundaryProps): JSX.Element {
  return (
    <ModuleError name={name}>
      <ModuleMotionConfig>{children}</ModuleMotionConfig>
    </ModuleError>
  );
}

function resolveTooltipConfig(
  tooltip: boolean | CoreTooltipConfig,
): CoreTooltipConfig | null {
  if (tooltip === false) return null;

  const custom = typeof tooltip === "object" ? tooltip : {};

  return {
    delayDuration: custom.delayDuration || DEFAULT_TOOLTIP_DELAY,
    skipDelayDuration: custom.skipDelayDuration || DEFAULT_TOOLTIP_SKIP_DELAY,
  };
}

/**
 * Props for {@link CoreProvider}: the modules to host, extra providers and
 * registry entries, content slots and tooltip configuration.
 */
export interface CoreProviderProps {
  children: ReactNode;
  modules: readonly AnyCoreModule[];
  overlays?: ReactNode;
  providers?: readonly ProviderEntry[];
  registryEntries?: readonly AppRegistryEntry[];
  slots?: CoreProviderSlots;
  tooltip?: boolean | CoreTooltipConfig;
}

/**
 * Root provider that mounts the global error boundary, tooltips, the module
 * host and any extra providers around the application.
 */
export function CoreProvider({
  children,
  modules,
  overlays,
  providers,
  registryEntries,
  slots,
  tooltip = true,
}: CoreProviderProps): JSX.Element {
  const tooltipConfig = useMemo(() => resolveTooltipConfig(tooltip), [tooltip]);

  const providerPipeline = useMemo<readonly ProviderEntry[]>(
    () => [
      GlobalError,
      ...(tooltipConfig
        ? [[TooltipPrimitive.Provider, tooltipConfig] as const]
        : []),
      [ModuleHost, { boundary: ModuleBoundary, modules, registryEntries }],
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
