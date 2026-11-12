import { isValidElement } from "react";

import type {
  ModulePageContext,
  PageConfig,
  PageRegistration,
  ValidationResult,
} from "@/core/kernel";
import { isObject, isPlainObject } from "@/foundation/utils";

import type { DockPageConfig } from "../types";

const CARD_FIELD_TYPES: Readonly<Record<string, string>> = Object.freeze({
  bannerOpacity: "number",
  bannerPosition: "string",
  bannerRepeat: "string",
  bannerSize: "string",
  bannerUrl: "string",
  dismissible: "boolean",
  isLoading: "boolean",
  isOverlay: "boolean",
  name: "string",
  path: "string",
  targetPath: "string",
  width: "number",
});

const POLICY_FIELD_TYPES: Readonly<Record<string, string>> = Object.freeze({
  clearTransientState: "boolean",
  dismissSurfaces: "boolean",
  prefetch: "boolean",
});

const BEHAVIOR_FIELDS: ReadonlySet<string> = new Set([
  "actions",
  "guard",
  "isLoading",
  "surfaces",
]);

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

/** Checks a dock registry entry's field types and returns any issues found. */
export function validateDockEntry(entry: unknown): ValidationResult {
  if (!isPlainObject(entry))
    return { issues: ["dock card must be a plain object"], valid: false };
  const issues: string[] = [];

  Object.entries(CARD_FIELD_TYPES).forEach(([field, expectedType]) => {
    const value = entry[field];
    if (value !== undefined && value !== null && typeof value !== expectedType)
      issues.push(`dock.${field} must be a ${expectedType}`);
  });
  ["title", "description"].forEach((field) => {
    if (!isRenderable(entry[field]))
      issues.push(`dock.${field} must be a renderable value`);
  });
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- entry.path is unvalidated input here; a non-string value stringifies to "[object Object]" and is reported as an invalid path, which is the point of this check
  if (entry.path !== undefined && !String(entry.path).startsWith("/"))
    issues.push("dock.path must start with /");
  if (entry.actions !== undefined && !Array.isArray(entry.actions))
    issues.push("dock.actions must be an array");
  if (entry.style !== undefined && !isPlainObject(entry.style))
    issues.push("dock.style must be a plain object");
  const policy = entry.dockPolicy;
  if (policy !== undefined) {
    if (!isPlainObject(policy)) {
      issues.push("dock.dockPolicy must be a plain object");
    } else {
      Object.entries(POLICY_FIELD_TYPES).forEach(([field, expectedType]) => {
        const value = policy[field];
        if (value !== undefined && typeof value !== expectedType)
          issues.push(`dock.dockPolicy.${field} must be a ${expectedType}`);
      });
    }
  }
  return { issues, valid: issues.length === 0 };
}

/** Merges dock registry entries in order, combining their style sections. */
export function mergeDockEntries(
  entries: Record<string, unknown>[],
): Record<string, unknown> {
  return entries.reduce<Record<string, unknown>>((merged, entry) => {
    const next = { ...merged, ...entry };
    const mergedStyle = merged.style;
    const entryStyle = entry.style;
    if (isObject(mergedStyle) && isObject(entryStyle)) {
      const style: Record<string, unknown> = { ...mergedStyle, ...entryStyle };
      ["card", "icon", "title", "description"].forEach((field) => {
        if (isObject(mergedStyle[field]) && isObject(entryStyle[field])) {
          style[field] = { ...mergedStyle[field], ...entryStyle[field] };
        }
      });
      next.style = style;
    }
    return next;
  }, {});
}

function pageLoadingFlag(loading: unknown): boolean | undefined {
  if (typeof loading === "boolean") return loading;
  if (typeof loading === "string") return true;
  if (isObject(loading) && typeof loading.isLoading === "boolean")
    return loading.isLoading;
  return undefined;
}

/** Extracts the dock slice from a page config, folding in its title, banner and loading flag. */
export function selectPageDock(config: PageConfig): DockPageConfig | null {
  const dock = config.dock;
  const title = dock?.title ?? config.title;
  if (!dock && title === undefined) return null;

  const slice: DockPageConfig = { ...(dock ?? {}) };
  if (title !== undefined) slice.title = title;

  const banner = slice.banner ?? slice.bannerUrl;
  if (isObject(banner)) {
    slice.bannerUrl = banner.url ?? banner.bannerUrl;
  } else if (banner !== undefined) {
    slice.bannerUrl = banner;
  }

  if (slice.isLoading === undefined) {
    const isLoading = pageLoadingFlag(config.loading);
    if (isLoading !== undefined) slice.isLoading = isLoading;
  }
  return slice;
}

/** Turns a page's dock slice into registry entries keyed by path. */
export function toDockEntries(
  slice: DockPageConfig,
  { pathname }: ModulePageContext,
): PageRegistration[] {
  const {
    confirmation: _confirmation,
    guard: _guard,
    surfaces: _surfaces,
    ...card
  } = slice as DockPageConfig & { confirmation?: unknown };
  if (!Object.keys(card).some((field) => !BEHAVIOR_FIELDS.has(field)))
    return [];

  const path =
    typeof card.path === "string" && card.path ? card.path : pathname;
  if (!path) return [];
  const value = Object.fromEntries(
    Object.entries({ ...card, path }).filter(
      ([, field]) => field !== undefined,
    ),
  );
  return [{ key: path, value }];
}
