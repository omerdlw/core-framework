import { type Context, createContext } from "react";

export function getOrCreateGlobalContext<T>(
  name: string,
  defaultValue: T,
): Context<T> {
  const sym = Symbol.for(`@omerdlw/base-framework/context/${name}`);
  // The global store is keyed by symbols, which Window/globalThis does not declare.
  const store = globalThis as unknown as Record<symbol, Context<T>>;
  if (!store[sym]) {
    store[sym] = createContext<T>(defaultValue);
  }
  return store[sym];
}
