import { isValidElement, type ReactNode } from "react";
import { isBrowser, isObject, toArray, toFiniteNumber } from "@/utils";
import {
  CONTEXT_MENU_VISIBILITY_EVENT,
  INITIAL_POSITION,
  MENU_SCREEN_MARGIN,
} from "./constants";
import {
  type ContextMenuConfig,
  type ContextMenuContextValue,
  type ContextMenuItem,
  type ContextMenuOpenInput,
  type ContextMenuPageMeta,
  type ContextMenuPosition,
  type ContextMenuResolvedHeader,
  type ContextMenuResolvedItem,
  type ContextMenuState,
} from "./types";
import { report } from "@/utils";

export function joinClassNames(
  ...classes: (string | boolean | null | undefined)[]
): string {
  return classes.filter(Boolean).join(" ");
}

const SCROLL_LOCK_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  " ",
  "Spacebar",
]);

export function isScrollLockKey(event: { key: string }): boolean {
  return SCROLL_LOCK_KEYS.has(event.key);
}

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
  if (isValidElement(value))
    return extractNodeText((value.props as { children?: ReactNode })?.children);
  return "";
}

export function resolveAsBoolean(
  value: unknown,
  context?: unknown,
  defaultValue = true,
): boolean {
  if (typeof value === "function") {
    try {
      return Boolean(value(context));
    } catch {
      return false;
    }
  }
  if (value === undefined) {
    return defaultValue;
  }
  return Boolean(value);
}

export function resolveAsValue<T = unknown>(
  value: unknown,
  context?: unknown,
  fallback?: T,
): T {
  if (typeof value === "function") {
    try {
      const resolved = value(context);
      return resolved === undefined ? (fallback as T) : resolved;
    } catch {
      return fallback as T;
    }
  }
  return value === undefined ? (fallback as T) : (value as T);
}

export function emitContextMenuVisibility(isOpen: boolean): void {
  if (!isBrowser) return;
  window.dispatchEvent(
    new CustomEvent(CONTEXT_MENU_VISIBILITY_EVENT, {
      detail: { isOpen: Boolean(isOpen) },
    }),
  );
}

export function safeInvoke<T = unknown>(
  handler: unknown,
  ...args: unknown[]
): T | undefined {
  if (typeof handler !== "function") return undefined;
  try {
    const result = handler(...args);
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

export function positionMenu(
  menuElement: HTMLElement | null,
  position?: ContextMenuPosition | null,
): void {
  if (!menuElement) return;
  const { height, width } = menuElement.getBoundingClientRect();
  const maxX = window.innerWidth - width - MENU_SCREEN_MARGIN;
  const maxY = window.innerHeight - height - MENU_SCREEN_MARGIN;

  const x = Math.min(Number(position?.x) || 0, maxX);
  const y = Math.min(Number(position?.y) || 0, maxY);

  menuElement.style.left = `${Math.round(Math.max(MENU_SCREEN_MARGIN, x))}px`;
  menuElement.style.top = `${Math.round(Math.max(MENU_SCREEN_MARGIN, y))}px`;
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

  const label = resolveAsValue(item.label, context, "");
  if (
    (typeof label !== "string" && typeof label !== "number") ||
    !String(label).trim()
  ) {
    return null;
  }

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
    label: String(label),
    onClick: handler,
    onSelect: handler,
    shortcut: typeof shortcut === "string" ? shortcut : null,
    type: "action",
  };
}

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

export function resolveMenuHeader(
  config: ContextMenuConfig | null | undefined,
  context: ContextMenuContextValue,
): ContextMenuResolvedHeader | null {
  if (config?.header === false || config?.showPageHeader === false) return null;

  const configured = resolveAsValue(config?.header, context, null);
  const source = isObject(configured)
    ? configured
    : isObject(context.page)
      ? context.page
      : null;
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

export function getNextActiveIndex(
  items: ContextMenuResolvedItem[],
  current: number,
  direction: 1 | -1,
): number {
  const count = items.length;
  const start =
    current < 0 ? (direction === 1 ? 0 : count - 1) : current + direction;

  for (let step = 0; step < count; step++) {
    const index = (((start + step * direction) % count) + count) % count;
    if (items[index].type === "action" && !items[index].disabled) return index;
  }
  return current;
}
