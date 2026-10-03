import { isValidElement, type ReactNode } from "react";

export function hasSlotContent(value: unknown): boolean {
  return (
    value !== null && value !== undefined && value !== false && value !== ""
  );
}

export function isHeaderConfig(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !isValidElement(value),
  );
}

export function resolveHeaderActions(
  actions:
    | ReactNode
    | ((props: { close?: (result?: unknown) => void }) => ReactNode)
    | undefined,
  close?: (result?: unknown) => void,
): ReactNode {
  return typeof actions === "function" ? actions({ close }) : actions || null;
}
