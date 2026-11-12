import { isValidElement, type ReactNode } from "react";

/**
 * Whether a slot value renders anything: not null, undefined, false or an empty string.
 */
export function hasSlotContent(value: unknown): boolean {
  return (
    value !== null && value !== undefined && value !== false && value !== ""
  );
}

/**
 * Whether a header value is a config object rather than a React node.
 */
export function isHeaderConfig(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !isValidElement(value),
  );
}

/**
 * Resolves header actions, calling them with `close` when they are a function.
 */
export function resolveHeaderActions(
  actions:
    | ReactNode
    | ((props: { close?: (result?: unknown) => void }) => ReactNode)
    | undefined,
  close?: (result?: unknown) => void,
): ReactNode {
  return typeof actions === "function" ? actions({ close }) : actions || null;
}
