"use client";

import { type Context, use } from "react";

/**
 * Reads a context that must have a provider, throwing a named error when it is missing.
 */
export function useRequiredContext<T>(
  context: Context<T | null>,
  hookName: string,
  providerName: string,
): T {
  const value = use(context);
  if (value === null) {
    throw new Error(`${hookName} must be used within ${providerName}`);
  }
  return value;
}
