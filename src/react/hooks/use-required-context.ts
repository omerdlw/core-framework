"use client";

import { type Context, use } from "react";

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
