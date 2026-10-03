import { isObject, toArray } from "@/utils";
import { CURRENT_PAGE_KEY, GLOBAL_MENU_KEY } from "./constants";
import { resolveMenuItems, resolveAsBoolean, safeInvoke } from "./items";
import {
  type ContextMenuCandidate,
  type ContextMenuConfig,
  type ContextMenuContextValue,
  type ContextMenuResolvedItem,
  type ContextMenuResolvedMatch,
} from "./types";

function normalizeMenuCandidates(
  registryMenus?: Record<string, unknown> | null,
): ContextMenuCandidate[] {
  const candidates: ContextMenuCandidate[] = [];

  for (const [registryKey, rawConfig] of Object.entries(registryMenus || {})) {
    if (!isObject(rawConfig)) continue;

    const { menus, ...sharedConfig } = rawConfig as ContextMenuConfig;
    const nestedMenus = toArray(menus);
    const hasSharedItems =
      Array.isArray(sharedConfig.items) ||
      typeof sharedConfig.items === "function";

    if (hasSharedItems || nestedMenus.length === 0) {
      candidates.push({
        config: sharedConfig,
        order: candidates.length,
        registryKey,
      });
    }

    for (const menu of nestedMenus) {
      candidates.push({
        config: {
          ...sharedConfig,
          ...menu,
          classNames: { ...sharedConfig.classNames, ...menu.classNames },
        },
        order: candidates.length,
        registryKey,
      });
    }
  }
  return candidates;
}

function isPathAllowed(
  config: ContextMenuConfig,
  registryKey: string,
  pathname?: string,
): boolean {
  if (!pathname) return true;
  if (config.path === pathname) return true;

  const explicitPaths = toArray(config.paths).filter(Boolean);
  if (explicitPaths.length > 0) return explicitPaths.includes(pathname);

  if (typeof config.pathMatcher === "function") {
    try {
      return Boolean(config.pathMatcher(pathname));
    } catch {
      return false;
    }
  }

  return (
    registryKey === pathname ||
    registryKey === CURRENT_PAGE_KEY ||
    registryKey === GLOBAL_MENU_KEY
  );
}

function getElementDepth(from: Element, ancestor: Element): number {
  let depth = 0;
  for (
    let node: Element | null = from;
    node && node !== ancestor;
    node = node.parentElement
  ) {
    depth += 1;
  }
  return depth;
}

function getTargetScore(
  config: ContextMenuConfig,
  targetElement: Element | null,
): number | null {
  const selectors = toArray(config.target).filter(
    (selector) => typeof selector === "string" && selector.trim(),
  );
  if (selectors.length === 0) return 0;
  if (!targetElement) return null;

  let minDepth = Infinity;
  for (const selector of selectors) {
    try {
      const matched = targetElement.closest(selector);
      if (matched) {
        minDepth = Math.min(minDepth, getElementDepth(targetElement, matched));
      }
    } catch {}
  }
  return minDepth === Infinity ? null : Math.max(0, 100 - minDepth);
}

function getRouteScore(
  config: ContextMenuConfig,
  registryKey: string,
  pathname?: string,
): number {
  if (!pathname) return 0;
  if (
    config.path === pathname ||
    toArray(config.paths).includes(pathname) ||
    registryKey === pathname
  ) {
    return 100;
  }
  if (registryKey === CURRENT_PAGE_KEY) return 70;
  if (registryKey === GLOBAL_MENU_KEY) return 40;
  return 10;
}

function buildMenuContext(
  config: ContextMenuConfig,
  event: MouseEvent,
  pathname?: string,
  targetElement?: Element | null,
): ContextMenuContextValue {
  let context: ContextMenuContextValue = {
    currentTarget: event.currentTarget ?? null,
    event,
    pathname: pathname || "",
    point: { x: Number(event.clientX) || 0, y: Number(event.clientY) || 0 },
    target: targetElement,
  };

  if (config.payload !== undefined) context.payload = config.payload;

  try {
    const payload = config.resolvePayload?.(event, context);
    if (payload !== undefined) context.payload = payload;
  } catch {}

  try {
    const extra = config.resolveContext?.(event, context);
    if (isObject(extra)) context = { ...context, ...extra };
  } catch {}

  return context;
}

function isMenuOverlayTarget(element: Element | null): boolean {
  return Boolean(
    element?.closest?.(
      '[data-context-menu-ignore], [data-context-menu-overlay], [role="menu"]',
    ) || element?.classList?.contains("context-menu-overlay"),
  );
}

function resolveEventTarget(event: MouseEvent): Element | null {
  const initialTarget = event.target instanceof Element ? event.target : null;

  if (initialTarget && !isMenuOverlayTarget(initialTarget)) {
    return initialTarget;
  }
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
    return initialTarget;
  }

  try {
    const underneath = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find((element) => !isMenuOverlayTarget(element));
    return underneath || initialTarget;
  } catch {
    return initialTarget;
  }
}

function passesWhen(
  config: ContextMenuConfig,
  event: MouseEvent,
  info: {
    context: ContextMenuContextValue;
    pathname: string;
    target: Element | null;
  },
): boolean {
  if (typeof config.when !== "function") return config.when !== false;
  try {
    return Boolean(config.when(event, info));
  } catch {
    return false;
  }
}

export function resolveContextMenu(
  registryMenus: Record<string, unknown> | null | undefined,
  pathname: string | undefined,
  event: MouseEvent,
): ContextMenuResolvedMatch | null {
  const targetElement = resolveEventTarget(event);
  let winner: ContextMenuResolvedMatch | null = null;

  for (const { config, order, registryKey } of normalizeMenuCandidates(
    registryMenus,
  )) {
    if (!isPathAllowed(config, registryKey, pathname)) continue;

    const context = buildMenuContext(config, event, pathname, targetElement);
    if (!resolveAsBoolean(config.enabled, context, true)) continue;
    if (
      !passesWhen(config, event, {
        context,
        pathname: pathname || "",
        target: targetElement,
      })
    ) {
      continue;
    }

    const items = resolveMenuItems(config, context);
    if (!items.length) continue;

    const targetScore = getTargetScore(config, targetElement);
    if (targetScore === null) continue;

    const priority = Number(config.priority);
    const score =
      (Number.isFinite(priority) ? priority : 0) * 10000 +
      getRouteScore(config, registryKey, pathname) * 100 +
      targetScore;

    if (!winner || score > winner.score) {
      winner = { config, context, items, order, score };
    }
  }
  return winner;
}

export function prepareMenu(
  config: ContextMenuConfig,
  context: ContextMenuContextValue,
  event: unknown,
): {
  context: ContextMenuContextValue;
  items: ContextMenuResolvedItem[];
} | null {
  const onOpenResult = safeInvoke(config.onOpen, event, context);
  if (onOpenResult === false) return null;

  const nextContext = isObject(onOpenResult)
    ? { ...context, ...(onOpenResult as Record<string, unknown>) }
    : context;
  const items = resolveMenuItems(config, nextContext);
  return items.length ? { context: nextContext, items } : null;
}
