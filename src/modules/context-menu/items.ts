import { isValidElement, type ReactNode } from "react";

import { isObject, report, toArray } from "@/foundation/utils";

import {
  type ContextMenuConfig,
  type ContextMenuContextValue,
  type ContextMenuItem,
  type ContextMenuPageMeta,
  type ContextMenuResolvedHeader,
  type ContextMenuResolvedItem,
} from "./types";

/**
 * Plain text of a React node.
 */
export function extractNodeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map(extractNodeText)
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (isValidElement(value)) {
    return extractNodeText((value.props as { children?: ReactNode })?.children);
  }
  return "";
}

/**
 * Reads a boolean that may be a function of the context; a throwing function
 * counts as false.
 */
export function resolveAsBoolean(
  value: unknown,
  context?: unknown,
  defaultValue = true,
): boolean {
  if (typeof value === "function") {
    try {
      return Boolean((value as (context?: unknown) => unknown)(context));
    } catch {
      return false;
    }
  }
  if (value === undefined) {
    return defaultValue;
  }
  return Boolean(value);
}

/**
 * Reads a value that may be a function of the context, with a fallback for
 * undefined or errors.
 */
export function resolveAsValue<T = unknown>(
  value: unknown,
  context?: unknown,
  fallback?: T,
): T {
  if (typeof value === "function") {
    try {
      const resolved = (value as (context?: unknown) => T | undefined)(context);
      return resolved === undefined ? (fallback as T) : resolved;
    } catch {
      return fallback as T;
    }
  }
  return value === undefined ? (fallback as T) : (value as T);
}

/**
 * Calls a handler, reporting errors instead of throwing, including rejected
 * promises.
 */
export function safeInvoke<T = unknown>(
  handler: unknown,
  ...args: unknown[]
): T | undefined {
  if (typeof handler !== "function") return undefined;
  try {
    const result = (handler as (...args: unknown[]) => unknown)(...args) as
      Promise<unknown> | undefined;
    if (result && typeof result.then === "function") {
      result.catch((err: unknown) =>
        report("Context menu async callback", err),
      );
    }
    return result as T;
  } catch (error) {
    report("Context menu callback", error);
    return undefined;
  }
}

/**
 * Builds the page metadata for the menu header from the active dock item.
 */
export function resolveContextMenuPageMeta(
  dockItem: unknown,
  pathname = "",
): ContextMenuPageMeta | null {
  if (!isObject(dockItem)) return null;
  const title = (dockItem.contextMenuTitle ??
    dockItem.title ??
    null) as ReactNode;
  const description = (dockItem.contextMenuDescription ??
    dockItem.description ??
    null) as ReactNode;
  const eyebrow = (dockItem.contextMenuEyebrow ??
    dockItem.eyebrow ??
    null) as ReactNode;
  const icon = (dockItem.contextMenuIcon ?? dockItem.icon ?? null) as ReactNode;

  if (!title && !description && !icon && !eyebrow) return null;

  return {
    description,
    descriptionText: extractNodeText(description),
    eyebrow,
    icon,
    path:
      typeof dockItem.path === "string" && dockItem.path
        ? dockItem.path
        : pathname,
    title,
    titleText:
      extractNodeText(title) ||
      (typeof dockItem.name === "string" ? dockItem.name : "") ||
      "",
  };
}

/** A label counts only when it is a non-blank string or number. */
function resolveLabel(
  item: ContextMenuItem,
  context: ContextMenuContextValue,
): string | null {
  const label = resolveAsValue(item.label, context, "");
  if (
    (typeof label !== "string" && typeof label !== "number") ||
    !String(label).trim()
  ) {
    return null;
  }
  return String(label);
}

function resolveItem(
  item: ContextMenuItem | "separator" | null | undefined,
  index: number,
  context: ContextMenuContextValue,
): ContextMenuResolvedItem | null {
  if (!item) return null;
  if (item === "separator" || item.type === "separator") {
    return {
      key: (item !== "separator" && item.key) || `separator-${index}`,
      type: "separator",
    };
  }

  if (
    resolveAsBoolean(item.hidden, context, false) ||
    !resolveAsBoolean(item.visible, context, true)
  ) {
    return null;
  }

  const label = resolveLabel(item, context);
  if (label === null) return null;

  const handler = item.onSelect ?? item.onClick ?? null;
  const shortcut = resolveAsValue(item.shortcut, context, null);

  return {
    ...item,
    className: resolveAsValue(item.className, context, "") || "",
    closeOnSelect: item.closeOnSelect !== false,
    danger: resolveAsBoolean(item.danger, context, false),
    disabled: resolveAsBoolean(item.disabled, context, false),
    icon: resolveAsValue(item.icon, context, null) || null,
    itemIconClassName:
      resolveAsValue(item.itemIconClassName, context, "") || "",
    key: item.key || `item-${index}`,
    label,
    onClick: handler,
    onSelect: handler,
    shortcut: typeof shortcut === "string" ? shortcut : null,
    type: "action",
  };
}

/**
 * Resolves a config's items, dropping hidden ones and stray separators.
 */
export function resolveMenuItems(
  config: ContextMenuConfig | null | undefined,
  context: ContextMenuContextValue,
): ContextMenuResolvedItem[] {
  const rawItems = resolveAsValue(config?.items, context, []);
  const items: ContextMenuResolvedItem[] = [];

  toArray(rawItems).forEach((raw, index) => {
    const item = resolveItem(raw, index, context);
    if (!item) return;
    const previous = items[items.length - 1];
    if (
      item.type === "separator" &&
      (!previous || previous.type === "separator")
    ) {
      return;
    }
    items.push(item);
  });

  if (items[items.length - 1]?.type === "separator") items.pop();
  return items;
}

/** The configured header wins; otherwise the page header is used. */
function pickHeaderSource(
  configured: unknown,
  page: unknown,
): Record<string, unknown> | null {
  if (isObject(configured)) return configured;
  if (isObject(page)) return page;
  return null;
}

/**
 * Resolves a menu's header from its config or the page, or null when there is
 * none.
 */
export function resolveMenuHeader(
  config: ContextMenuConfig | null | undefined,
  context: ContextMenuContextValue,
): ContextMenuResolvedHeader | null {
  if (config?.header === false || config?.showPageHeader === false) return null;

  const configured = resolveAsValue(config?.header, context, null);
  const source = pickHeaderSource(configured, context.page);
  if (!source) return null;

  const title = resolveAsValue(source.title, context, null);
  const description = resolveAsValue(source.description, context, null);
  const icon = resolveAsValue(source.icon, context, null);
  const eyebrow = resolveAsValue(source.eyebrow, context, null);
  if (!title && !description && !icon && !eyebrow) return null;

  return {
    description,
    descriptionText: extractNodeText(description),
    eyebrow,
    icon,
    title,
    titleText: extractNodeText(title),
  };
}
