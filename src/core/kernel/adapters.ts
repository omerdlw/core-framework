"use client";

import { useRegistry } from "./hooks";
import { useInstalledModules } from "./installed";
import { pickRegistryMetadata } from "./schema";
import type { ModuleId, PageConfig, RegistryMetadata } from "./types";

/**
 * Registers a value for an installed module for as long as the component is
 * mounted.
 */
export function useModuleRegistration(
  id: ModuleId,
  value: unknown,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  const coreModule = useInstalledModules().find(
    (candidate) => candidate.id === id,
  );
  const config =
    coreModule && options?.enabled !== false && value != null
      ? ({ [id]: value } as PageConfig)
      : null;
  useRegistry(config, pickRegistryMetadata(options));
}
