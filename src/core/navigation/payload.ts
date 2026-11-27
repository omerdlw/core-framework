import { report } from "@/foundation/utils";

import type {
  NavigationPayload,
  NavigationPayloadKey,
  NavigationPayloadValue,
} from "./types";

export function createPayloadProviders() {
  const providers: { key: string; value: unknown }[] = [];

  function collectPayload(extra?: Partial<NavigationPayload>) {
    const payload: Record<string, unknown> = {};
    for (const { key, value } of providers) {
      try {
        // Payload values are lazy when given as a function; narrowing a
        // generic value union to a callable needs the cast.
        payload[key] =
          typeof value === "function" ? (value as () => unknown)() : value;
      } catch (error) {
        report(`Navigation payload (${key})`, error);
      }
    }
    return { ...payload, ...extra };
  }

  function provide<K extends NavigationPayloadKey>(
    key: K,
    value: NavigationPayloadValue<K>,
  ): () => void {
    const entry = { key, value };
    providers.push(entry);
    return () => {
      const index = providers.indexOf(entry);
      if (index !== -1) providers.splice(index, 1);
    };
  }

  return { collectPayload, provide };
}
