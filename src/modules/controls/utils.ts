import { isValidElement } from "react";
import { type ValidationResult } from "@/kernel";
import { clamp, isPlainObject, toFiniteNumber, trimToNull } from "@/utils";
import {
  CONTROLS_DOCK_GAP,
  CONTROLS_EDGE_INSET,
  CONTROL_SIDE_NAMES,
} from "./constants";
import {
  type ControlEntry,
  type ControlSide,
  type ControlsLayout,
  type ControlsPageConfig,
  type ControlsPairItem,
  type PageControlEntry,
  type ResolvedControlsPairs,
  type ViewportDimensions,
} from "./types";

export function isControlSide(value: unknown): value is ControlSide {
  return CONTROL_SIDE_NAMES.includes(value as ControlSide);
}

function hasContent(content: unknown): boolean {
  return content !== undefined && content !== null && content !== false;
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

export function getControlsLayout(
  dockRect: Pick<DOMRect, "bottom" | "height" | "left" | "right"> | null,
  viewport: ViewportDimensions,
): ControlsLayout | null {
  const { height, width } = viewport;
  if (!dockRect || width <= 0 || height <= 0) return null;

  const inset = CONTROLS_EDGE_INSET;
  const gap = CONTROLS_DOCK_GAP;
  const dockLeft = clamp(dockRect.left, 0, width);
  const dockRight = clamp(dockRect.right, dockLeft, width);
  const dockBottom = clamp(dockRect.bottom, 0, height);

  return {
    bottom: Math.max(0, height - dockBottom),
    height: Math.max(0, dockRect.height) / 2,
    left: {
      maxWidth: Math.max(0, dockLeft - inset * 2 - gap),
      right: Math.max(inset, width - dockLeft + gap),
    },
    right: {
      left: Math.min(width - inset, dockRight + gap),
      maxWidth: Math.max(0, width - dockRight - inset * 2 - gap),
    },
  };
}

export function areLayoutsEqual(
  a: ControlsLayout | null,
  b: ControlsLayout | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.bottom === b.bottom &&
    a.height === b.height &&
    a.isHidden === b.isHidden &&
    a.left.maxWidth === b.left.maxWidth &&
    a.left.right === b.left.right &&
    a.right.left === b.right.left &&
    a.right.maxWidth === b.right.maxWidth
  );
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
