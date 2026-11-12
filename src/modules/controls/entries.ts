import { createElement, isValidElement, type ReactNode } from "react";

import { type ValidationResult } from "@/core/kernel";
import { isPlainObject, toFiniteNumber, trimToNull } from "@/foundation/utils";

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

/**
 * Whether a value is a valid control side.
 */
export function isControlSide(value: unknown): value is ControlSide {
  return CONTROL_SIDE_NAMES.includes(value as ControlSide);
}

/**
 * Whether content is something other than undefined, null or false.
 */
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

/**
 * Checks that a registered control has an id, side, order and renderable
 * content.
 */
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

/**
 * Turns a slot into a node, rendering component and function slots with the
 * given props.
 */
export function resolveSlot(
  slot: ControlSlot | undefined,
  props: Record<string, unknown>,
): ReactNode {
  if (slot == null || slot === false) return null;
  if (isValidElement(slot)) return slot;
  if (typeof slot === "function") return createElement(slot, props);
  return slot;
}

/**
 * Converts a page `controls` setting into a list of entries, or null when it is
 * empty.
 */
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

interface PairRow {
  left?: ControlsPairItem;
  right?: ControlsPairItem;
}

/** Groups a path's controls into rows by order; the lowest id wins a side. */
function groupControlRows(
  entries: Record<string, ControlEntry> | ControlEntry[] | null | undefined,
  pathname: string,
): Map<number, PairRow> {
  const rows = new Map<number, PairRow>();

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
  return rows;
}

/**
 * Pairs a path's left and right controls by order. Rows missing either side
 * are dropped.
 */
export function resolveControlsPairs(
  entries: Record<string, ControlEntry> | ControlEntry[] | null | undefined,
  pathname: string,
): ResolvedControlsPairs {
  const pairs = [...groupControlRows(entries, pathname)]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row)
    .filter((row): row is Required<PairRow> => Boolean(row.left && row.right));

  return {
    left: pairs.map((row) => row.left),
    right: pairs.map((row) => row.right),
  };
}
