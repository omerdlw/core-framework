"use client";

export * from "./types/registry";

export { REGISTRY_SOURCES } from "./constants";

export { getOrCreateGlobalContext } from "@/react/context";
export { hasOwnProperty } from "./utils";

export { createRegistryOperations } from "./registry/operations";

export {
  RegistryProvider,
  useRegistryEntries,
  useRegistryValue,
} from "./registry/provider";

export { createRegistryStore } from "./registry/store";
export { createModuleRegistryDefinitions, sortModules } from "./host/installed";

export {
  ModuleHost,
  defineModule,
  definePeer,
  useModule,
  useIsModuleInstalled,
  ModuleBoundary,
  useModuleState,
} from "./host/module";

export { applyRegistryConfig } from "./registry/apply";

export { createRegistryApplyContext } from "./registry/hooks";

export { useModuleRegistration } from "./host/registration";

export { PageControllerProvider, usePage, usePageController } from "./page";

export { Compose, type ProviderEntry } from "./host/compose";
