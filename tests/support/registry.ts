import {
  createModuleRegistryDefinitions,
  createRegistryOperations,
  createRegistryStore as createStoreWith,
} from "../../src/core/kernel/index.ts";
import { backgroundModule } from "../../src/modules/background/module.tsx";
import { contextMenuModule } from "../../src/modules/context-menu/module.tsx";
import { controlsModule } from "../../src/modules/controls/module.tsx";
import { dockModule } from "../../src/modules/dock/module.tsx";
import { loadingModule } from "../../src/modules/loading/module.tsx";
import { mediaModule } from "../../src/modules/media/module.tsx";
import { modalModule } from "../../src/modules/modal/module.tsx";

export const builtInModules = Object.freeze([
  backgroundModule,
  contextMenuModule,
  controlsModule,
  dockModule,
  loadingModule,
  mediaModule,
  modalModule,
]);

export const registryDefinitions = createModuleRegistryDefinitions(
  builtInModules as any,
);

export const registryOperations = createRegistryOperations(registryDefinitions);

export function createRegistryStore(initialEntries: any[] = []) {
  return createStoreWith(initialEntries, registryDefinitions);
}
