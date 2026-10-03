import { createElement, isValidElement, type ReactNode } from "react";
import { type ValidationResult } from "@/kernel";
import { isPlainObject, toFiniteNumber, trimToNull } from "@/utils";
import { CONTROL_SIDE_NAMES } from "./constants";
import {
  type ControlEntry,
  type ControlSide,
  type ControlSlot,
  type ControlsPageConfig,
  type ControlsPairItem,
  type PageControlEntry,
  type ResolvedControlsPairs,
} from "./types";

export function isControlSide(value: unknown): value is ControlSide {
  return CONTROL_SIDE_NAMES.includes(value as ControlSide);
}

export function hasContent(content: unknown): boolean {
  return content !== undefined && content !== null && content !== false;
}

function isRenderable(value: unknown): boolean {
  if (
    value === null ||
    value === undefined ||
    ["boolean", "number", "string"].includes(typeof value) ||
    isValidElement(value)
  ) {
    return true;
  }
  return Array.isArray(value) && value.every(isRenderable);
}

export function validateControlEntry(entry: unknown): ValidationResult {
  if (!isPlainObject(entry)) {
    return { issues: ["control must be a plain object"], valid: false };
  }
  const issues: string[] = [];
  if (!trimToNull(entry.id)) {
    issues.push("control id must be a non-empty string");
  }
  if (!isControlSide(entry.side)) {
    issues.push("control side must be left or right");
  }
  if (!hasContent(entry.content) || !isRenderable(entry.content)) {
    issues.push("control content must be renderable");
  }
  if (!Number.isFinite(Number(entry.order))) {
    issues.push("control order must be a finite number");
  }
  return { issues, valid: issues.length === 0 };
}

export function resolveSlot(
  slot: ControlSlot | undefined,
  props: Record<string, unknown>,
): ReactNode {
  if (slot == null || slot === false) return null;
  if (isValidElement(slot)) return slot;
  if (typeof slot === "function") return createElement(slot, props);
  return slot;
}

export function normalizePageControls(
  controls: ControlsPageConfig | null | undefined,
): PageControlEntry[] | null {
  if (!controls) return null;
  if (Array.isArray(controls)) return controls;
  if ("side" in controls) return [controls];

  const { id = "controls", order = 0, path, registry } = controls;
  return CONTROL_SIDE_NAMES.flatMap((side) => {
    const content = controls[side];
    if (!hasContent(content)) return [];
    return [
      {
        ...(registry ? { registry } : {}),
        content,
        id: `${id}-${side}`,
        order,
        ...(path ? { path } : {}),
        side,
      },
    ];
  });
}

export function resolveControlsPairs(
  entries: Record<string, ControlEntry> | ControlEntry[] | null | undefined,
  pathname: string,
): ResolvedControlsPairs {
  const rows = new Map<
    number,
    { left?: ControlsPairItem; right?: ControlsPairItem }
  >();

  for (const entry of Array.isArray(entries)
    ? entries
    : Object.values(entries || {})) {
    if (
      entry?.path !== pathname ||
      !isControlSide(entry.side) ||
      !hasContent(entry.content)
    ) {
      continue;
    }
    const order = toFiniteNumber(entry.order);
    const row = rows.get(order) ?? {};
    rows.set(order, row);
    const current = row[entry.side];
    if (!current || String(entry.id).localeCompare(String(current.id)) < 0) {
      row[entry.side] = { content: entry.content, id: entry.id };
    }
  }

  const pairs = [...rows]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row)
    .filter((row): row is Required<typeof row> =>
      Boolean(row.left && row.right),
    );

  return {
    left: pairs.map((row) => row.left),
    right: pairs.map((row) => row.right),
  };
}
