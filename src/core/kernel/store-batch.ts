import { DEFAULT_SOURCE } from "./constants";
import type { RegistryOperations } from "./operations";
import { createUnregisterOperation } from "./operations";
import { createRegistrationHandle } from "./store-handles";
import { prepareRegisterOperation } from "./store-registration";
import type {
  RegistrationHandle,
  RegistryDefinitions,
  RegistryMetadata,
  RegistryOperation,
  RegistryQueue,
  RegistrySourceOrOptions,
  RegistryStore,
} from "./types";

interface BatchQueueInit {
  definitions: RegistryDefinitions;
  getStore: () => RegistryStore;
  nextSequence: () => number;
  operations: RegistryOperation[];
  ops: RegistryOperations;
  timestamp: number;
}

/**
 * Creates the queue handed to a batch executor. It records operations instead
 * of applying them, so the store can commit them together.
 */
export function createBatchQueue({
  definitions,
  getStore,
  nextSequence,
  operations,
  ops,
  timestamp,
}: BatchQueueInit): RegistryQueue {
  return {
    register: (
      type: string,
      key: string,
      item: unknown,
      sourceOrOptions: RegistrySourceOrOptions = DEFAULT_SOURCE,
      optionsArg: RegistryMetadata = {},
    ): RegistrationHandle => {
      const prepared = prepareRegisterOperation(
        ops,
        definitions,
        type,
        key,
        item,
        sourceOrOptions,
        optionsArg,
        timestamp,
        nextSequence(),
      );
      if ("rejected" in prepared) return prepared.rejected;

      operations.push(prepared.operation);
      return createRegistrationHandle(getStore(), prepared.operation);
    },
    unregister: (
      type: string,
      key: string,
      sourceOrOptions: RegistrySourceOrOptions = DEFAULT_SOURCE,
    ): void => {
      if (!ops.isValidRegistryTarget(type, key)) return;
      operations.push(createUnregisterOperation(type, key, sourceOrOptions));
    },
  };
}
