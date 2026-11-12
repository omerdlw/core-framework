"use client";

import { pickRegistryMetadata } from "./schema";
import { useRegistry } from "./hooks";
import { useInstalledModules } from "./installed";
import type { ModuleId, PageConfig, RegistryMetadata } from "./types";

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
