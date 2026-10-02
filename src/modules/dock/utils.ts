import {
  normalizePath,
  isObject as isObjectLike,
  trimToNull,
  cn,
  isPlainObject,
  createScheduler,
  type CoreSchedulerOptions,
} from "@/utils";
import { isValidElement, type ReactNode, type CSSProperties } from "react";
import {
  type DockComponent,
  type DockVisualStyleSection,
  type DockItem,
  type DockHudDescriptor,
  type NormalizedSurfaceExtension,
  type SurfaceDescriptor,
  type DockTheme,
  type SurfaceExtension,
  type SurfaceFlowDefinition,
  type SurfaceFlowReturnInput,
  type SurfaceReturnHandshake,
  type SurfaceReturnHandshakeInput,
} from "./types";
import {
  DOCK_FOCUSABLE_SELECTOR,
  DOCK_FOCUS_RESTORE_BLOCKED_REASONS,
} from "./constants";

export function isSamePath(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  return Boolean(
    normalizedLeft && normalizedRight && normalizedLeft === normalizedRight,
  );
}

export function isPathPrefix(
  candidatePath: unknown,
  pathname: unknown,
): boolean {
  const normalizedCandidate = normalizePath(candidatePath);
  const normalizedPathname = normalizePath(pathname);
  if (!normalizedCandidate || !normalizedPathname) return false;
  if (normalizedCandidate === normalizedPathname) return true;
  if (normalizedCandidate === "/") return normalizedPathname.startsWith("/");
  return normalizedPathname.startsWith(`${normalizedCandidate}/`);
}

export function isInlineActionPathMatch(
  path: unknown,
  pathname: unknown,
): boolean {
  return (
    isSamePath(path, pathname) || (path !== "/" && isPathPrefix(path, pathname))
  );
}

export function isSafeInternalHref(value: unknown): boolean {
  const href = typeof value === "string" ? value.trim() : "";
  return href.startsWith("/") && !href.startsWith("//");
}

export function getDockLocationKey({
  hash = "",
  pathname = "/",
  search = "",
}: {
  hash?: string;
  pathname?: string;
  search?: string;
} = {}): string {
  const normalizedPathname = String(pathname || "/").trim() || "/";
  const normalizedSearch = String(search || "").trim();
  const normalizedHash = String(hash || "").trim();
  const query = normalizedSearch
    ? normalizedSearch.startsWith("?")
      ? normalizedSearch
      : `?${normalizedSearch}`
    : "";
  const fragment = normalizedHash
    ? normalizedHash.startsWith("#")
      ? normalizedHash
      : `#${normalizedHash}`
    : "";
  return `${normalizedPathname}${query}${fragment}`;
}

export function formatMediaTime(seconds: number | string = 0): string {
  const sec = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function isValidBannerUrl(banner: unknown): boolean {
  const value = trimToNull(banner);
  if (!value) return false;
  return /^(https?:\/\/|\/|data:image\/)/.test(value);
}

export function toObject(value: unknown): Record<string, unknown> {
  return isObjectLike(value) ? value : {};
}

export function isValidComponentType(type: unknown): type is DockComponent {
  if (typeof type === "function") return true;
  return Boolean(
    type != null &&
    typeof type === "object" &&
    !isValidElement(type) &&
    "$$typeof" in type,
  );
}

export function resolveComponentType(
  ...candidates: unknown[]
): DockComponent | null {
  return candidates.find(isValidComponentType) ?? null;
}

export function resolveRenderableContent(
  ...candidates: ReactNode[]
): ReactNode | null {
  return (
    candidates.find(
      (candidate) => candidate !== null && candidate !== undefined,
    ) ?? null
  );
}

function collectSearchableText(
  value: unknown,
  visitedObjects: WeakSet<object>,
): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) {
    if (visitedObjects.has(value)) return "";
    visitedObjects.add(value);
    const text = value
      .map((entry) => collectSearchableText(entry, visitedObjects))
      .join(" ");
    visitedObjects.delete(value);
    return text;
  }
  if (isValidElement(value)) {
    if (visitedObjects.has(value)) return "";
    visitedObjects.add(value);
    const text = collectSearchableText(
      (value.props as { children?: ReactNode } | null)?.children,
      visitedObjects,
    );
    visitedObjects.delete(value);
    return text;
  }
  if (value && typeof value === "object") {
    if (visitedObjects.has(value)) return "";
    visitedObjects.add(value);
    return Object.values(value)
      .map((entry) => collectSearchableText(entry, visitedObjects))
      .join(" ");
  }
  return "";
}

export function toSearchableText(value: unknown): string {
  return collectSearchableText(value, new WeakSet());
}

export type DockStyleInput = DockVisualStyleSection;

export function normalizeUpper(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function splitStyle<T extends DockStyleInput>(
  style: T = {} as T,
): {
  className: string | undefined;
  inlineStyle: Omit<T, "className">;
} {
  const { className, ...inlineStyle } = style;
  return {
    className,
    inlineStyle,
  };
}

export function getLineClampStyle(
  maxLines: number | string | undefined,
  style: CSSProperties,
): CSSProperties {
  if (Number(maxLines) <= 1) return style;
  return {
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: maxLines,
    display: "-webkit-box",
    overflow: "hidden",
    ...style,
  };
}

export function getImageIconStyle(
  style: CSSProperties,
  icon: string,
): CSSProperties {
  const nextStyle = {
    ...style,
  };
  delete nextStyle.background;
  delete nextStyle.backgroundImage;
  return {
    ...nextStyle,
    backgroundImage: `url(${icon})`,
  };
}

export function resolveDockActionClass(
  slots: DockTheme["slots"],
  {
    className = "",
    button = "",
    isActive = false,
    variant = "",
    tone = "",
    base,
    cn: classNamesFn,
  }: {
    className?: string;
    button?: string;
    isActive?: boolean;
    variant?: string;
    tone?: string;
    base?: string;
    cn?: (...args: Parameters<typeof cn>) => string;
  } = {},
): string {
  const resolve = classNamesFn || cn;
  const toneClasses: Readonly<Record<string, string | undefined>> = {
    muted: slots.actionMuted,
    active: slots.actionActive,
  };
  if (button && !className && base === undefined) {
    if (tone) {
      const toneClass =
        toneClasses[tone] || slots.actionSurface || slots.actionMuted;
      return resolve(button, toneClass);
    }
    const stateToken = isActive ? slots.actionActive : slots.actionMuted;
    return resolve(button, stateToken);
  }
  const elementClass = className || button;
  const resolvedBase = base !== undefined ? base : slots.action;
  const stateClass =
    variant ||
    (tone && (toneClasses[tone] || slots.actionSurface)) ||
    (isActive ? slots.actionActive : slots.actionMuted);
  return resolve(stateClass, resolvedBase, elementClass);
}

export function blurActiveElement(): void {
  if (typeof document === "undefined") return;
  const activeElement = document.activeElement as HTMLElement | null;
  if (activeElement && typeof activeElement.blur === "function") {
    activeElement.blur();
  }
}

function closestMatches(target: unknown, selector: string): boolean {
  const element = target as Partial<Element> | null | undefined;
  return Boolean(
    element &&
    typeof element.closest === "function" &&
    element.closest(selector),
  );
}

export function isInteractiveTarget(target: unknown): boolean {
  return closestMatches(
    target,
    'button, a, input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])',
  );
}

export function isEditableDockTarget(target: unknown): boolean {
  return closestMatches(
    target,
    'input, textarea, select, [contenteditable="true"]',
  );
}

export function getDockFocusableElements(
  container: HTMLElement | null,
): HTMLElement[] {
  if (!container || typeof container.querySelectorAll !== "function") return [];
  return (
    Array.from(
      container.querySelectorAll(DOCK_FOCUSABLE_SELECTOR),
    ) as HTMLElement[]
  ).filter((element) => {
    if (!element || element.getAttribute("aria-hidden") === "true")
      return false;
    const style =
      typeof window !== "undefined" ? window.getComputedStyle(element) : null;
    return (
      style?.display !== "none" &&
      style?.visibility !== "hidden" &&
      style?.pointerEvents !== "none"
    );
  });
}

export function focusDockElement(element: HTMLElement | null): boolean {
  if (!element || typeof element.focus !== "function") return false;
  try {
    element.focus({ preventScroll: true });
    return document.activeElement === element;
  } catch {
    return false;
  }
}

export function shouldRestoreDockFocus(result: unknown): boolean {
  const blockedReason = (result as { blockedReason?: unknown } | null)
    ?.blockedReason;
  return (
    !result ||
    !(DOCK_FOCUS_RESTORE_BLOCKED_REASONS as readonly unknown[]).includes(
      blockedReason,
    )
  );
}

type AncestorAwareItem = DockItem & {
  keepWhenDescendant?:
    boolean | ((activePath: string, item: DockItem) => boolean);
  statusType?: string;
};

function isSameDockItem(
  item: DockItem | null | undefined,
  candidate: DockItem | null | undefined,
): boolean {
  return Boolean(
    (item?.path && item.path === candidate?.path) ||
    (item?.name && item.name === candidate?.name),
  );
}

export const isSameItem = isSameDockItem;

export function getItemKey(link: DockItem | null, index = 0): string {
  const identity = link?.id ?? link?.path ?? link?.name ?? link?.type;
  return `dock-card:${identity == null ? `slot-${index}` : String(identity)}`;
}

export function getItemMeasurementKey({
  link,
  expanded,
  isHud = false,
}: {
  link: DockItem;
  expanded: boolean;
  isHud?: boolean;
  isHovered?: boolean;
  isStackHovered?: boolean;
}): string {
  const state = isHud
    ? "hud"
    : link.isLoading
      ? "loading"
      : link.isSurface
        ? `surface-${link.surfacePhase ?? "open"}`
        : "standard";
  return `${link.path || link.name || "item"}:${state}:${expanded ? "expanded" : "collapsed"}`;
}

export function getRouteMeasurementKey(
  pathname: string | null,
  key: string,
): string {
  return `${pathname || ""}:${key}`;
}

export function resolveDockHeaderKey({
  link,
  description = "",
  showVideoIcon = false,
}: {
  link: AncestorAwareItem;
  description?: string | null;
  showVideoIcon?: boolean;
}): string {
  const statusPart = link?.isStatus
    ? `status:${link.statusType || link.type || "status"}`
    : "standard";
  const identityPart = link?.path || link?.name || link?.id || "item";
  const titlePart = link?.title || link?.name || "";
  const descPart = description || "";
  const iconPart = showVideoIcon ? "video" : link?.icon || "no-icon";
  return `${statusPart}:${identityPart}:${iconPart}:${titlePart}:${descPart}`;
}

export function findDockItemIndex(
  dockItems: DockItem[],
  activeItem: DockItem | null,
  pathname: string,
): number {
  const normalizedPathname = normalizePath(pathname);
  const selectedDataSourceIndex = dockItems.findIndex(
    (item) => item.isDataSource && item.isSelected,
  );
  if (selectedDataSourceIndex !== -1) return selectedDataSourceIndex;

  if (activeItem) {
    const matchedActiveIndex = dockItems.findIndex(
      (item) =>
        (item.path && isSamePath(item.path, activeItem.path)) ||
        (item.name && item.name === activeItem.name),
    );
    if (matchedActiveIndex !== -1) return matchedActiveIndex;
  }

  return dockItems.findIndex(
    (item) =>
      isSamePath(item.path, normalizedPathname) ||
      (item.targetPath && isSamePath(item.targetPath, normalizedPathname)),
  );
}

export function resolveActiveIndex({
  dockItems,
  activeItem,
  pathname,
}: {
  dockItems: DockItem[];
  activeItem: DockItem | null;
  pathname: string;
}): number {
  return Math.max(0, findDockItemIndex(dockItems, activeItem, pathname));
}

function shouldKeepAncestorItem(
  item: AncestorAwareItem,
  activePath: string,
): boolean {
  const policy = item?.keepWhenDescendant;
  if (typeof policy === "function") {
    try {
      return Boolean(policy(activePath, item));
    } catch {
      return false;
    }
  }
  return policy === true;
}

function isAncestorPath(item: AncestorAwareItem, activePath: string): boolean {
  const candidatePath = item?.path;
  if (!candidatePath || candidatePath === "/" || candidatePath === activePath)
    return false;
  return (
    isPathPrefix(candidatePath, activePath) &&
    !shouldKeepAncestorItem(item, activePath)
  );
}

export function removeAncestorDuplicates(items: DockItem[] = []): DockItem[] {
  if (!Array.isArray(items) || items.length <= 1) return items;
  const activePath = items[0]?.path;
  if (!activePath) return items;

  return items.filter(
    (item, index) => index === 0 || !isAncestorPath(item, activePath),
  );
}

export function replaceActiveItem(
  items: DockItem[],
  activeIndex: number,
  activeItem: DockItem | null,
): DockItem[] {
  if (activeIndex === -1 || !activeItem) return items;
  const nextItems = [...items];
  nextItems[activeIndex] = activeItem;
  return nextItems;
}

export function removeInactiveLoadingItems(
  items: DockItem[] = [],
  activeItem: DockItem | null = null,
): DockItem[] {
  if (!Array.isArray(items) || items.length === 0) return items;
  return items.filter(
    (item) => !item?.isLoading || isSameItem(item, activeItem),
  );
}

export function reorderItemsWithActiveFirst(
  items: DockItem[],
  activeIndex: number,
): DockItem[] {
  if (activeIndex === -1) return items;
  const active = items[activeIndex];
  const rest = [
    ...items.slice(0, activeIndex),
    ...items.slice(activeIndex + 1),
  ];
  rest.sort((a, b) => (a.path === "/" ? 1 : b.path === "/" ? -1 : 0));
  return [active, ...rest];
}

export function isHudDescriptor(value: unknown): value is DockHudDescriptor {
  return (
    isObjectLike(value) &&
    !isValidElement(value) &&
    ("component" in value ||
      "content" in value ||
      "node" in value ||
      "element" in value ||
      "isActive" in value ||
      "id" in value)
  );
}

export function isSurfaceDescriptor(
  value: unknown,
): value is SurfaceDescriptor {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !isValidElement(value)
  );
}

let generatedExtensionId = 0;

export function normalizeSurfaceExtension(
  input: unknown,
): NormalizedSurfaceExtension | null {
  if (!input) return null;
  if (isValidElement(input)) {
    return {
      align: "left" as const,
      className: "",
      component: null,
      content: input,
      id: `ext-${++generatedExtensionId}`,
      order: 0,
      props: {},
      unstyled: false,
    };
  }
  if (typeof input !== "object") return null;
  const extension = input as SurfaceExtension;

  const component = isValidComponentType(extension.component)
    ? extension.component
    : null;
  const content =
    isValidElement(extension.content) ||
    typeof extension.content === "string" ||
    typeof extension.content === "number"
      ? extension.content
      : null;

  if (!component && content == null) return null;

  const align =
    extension.align === "right" || extension.align === "end"
      ? "right"
      : extension.align === "center"
        ? "center"
        : "left";

  return {
    align,
    className:
      typeof extension.className === "string" ? extension.className : "",
    component,
    content,
    id: String(
      extension.id || extension.key || `ext-${++generatedExtensionId}`,
    ),
    order: Number.isFinite(Number(extension.order))
      ? Number(extension.order)
      : 0,
    props: isPlainObject(extension.props) ? extension.props : {},
    unstyled: Boolean(extension.unstyled),
  };
}

export function normalizeSurfaceFlowSnapshot(
  value: unknown,
): Record<string, unknown> | null {
  if (!isPlainObject(value)) return null;
  return { ...value };
}

export function createSurfaceReturnHandshake(
  input: SurfaceReturnHandshakeInput,
): SurfaceReturnHandshake | null {
  const source = typeof input === "string" ? { pathname: input } : input;
  const pathname =
    typeof source?.pathname === "string" ? source.pathname.trim() : "";

  if (!isSafeInternalHref(pathname)) return null;

  return {
    focusKey:
      typeof source?.focusKey === "string" && source.focusKey.trim()
        ? source.focusKey.trim()
        : null,
    pathname,
    restoreScroll: source?.restoreScroll !== false,
    returnOnCancel: source?.returnOnCancel === true,
  };
}

export function resolveSurfaceFlowReturnHandshake(
  definition: Pick<SurfaceFlowDefinition, "returnHandshake"> | null | undefined,
  input: unknown,
): SurfaceReturnHandshake | null {
  const flowInput = (
    input && typeof input === "object" ? input : null
  ) as SurfaceFlowReturnInput | null;
  const inputHandshake =
    flowInput?.returnHandshake ??
    (flowInput?.returnTo
      ? {
          focusKey: flowInput.returnFocusKey,
          pathname: flowInput.returnTo,
          restoreScroll: flowInput.restoreReturnScroll,
          returnOnCancel: flowInput.returnOnCancel,
        }
      : null);
  const baseHandshake = definition?.returnHandshake;

  if (!baseHandshake && !inputHandshake) return null;
  return createSurfaceReturnHandshake({ ...baseHandshake, ...inputHandshake });
}

export function createDockScheduler(options: CoreSchedulerOptions = {}) {
  return createScheduler({
    defaultLabel: "dock-task",
    ...options,
  });
}
