"use client";

import { type RegistryMetadata, useModuleRegistration } from "@/core/kernel";

import type { DockPageConfig } from "../types";

export function useDockRegistration(
  config: DockPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean; [key: string]: unknown },
): void {
  useModuleRegistration("dock", config, options);
}
