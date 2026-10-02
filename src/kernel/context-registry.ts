import { createContext, type Context } from "react";

export function getOrCreateGlobalContext<T>(
  name: string,
  defaultValue: T,
): Context<T> {
  const sym = Symbol.for(`@omerdlw/base-framework/context/${name}`);
  const store = globalThis as unknown as Record<symbol, Context<T>>;
  if (!store[sym]) {
    store[sym] = createContext<T>(defaultValue);
  }
  return store[sym];
}
