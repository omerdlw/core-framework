"use client";

import {
  isValidElement,
  useInsertionEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  defineModule,
  type ModulePageContext,
  type PageConfig,
  type PageRegistration,
  type ValidationResult,
  type PageModuleApi,
} from "@/kernel";
import { isObject, isPlainObject } from "@/utils";
import { createInlineSurfaceEntry } from "./surface/definition";
import {
  type DockActions,
  type DockPageConfig,
  type DockPageApi,
  type DockPageGuard,
  type DockSlotContent,
  type DockStatusTheme,
  type DockSurfaceSlot,
} from "./types";
import { DockContext, statusActionDefaults, useDockActions } from "./context";
import { useDockGuard } from "./routing/guards";
import { useDockContextActions } from "./runtime/commands";
import { DockProvider } from "./provider";
import { Dock, ErrorActions, GuardActions, NotFoundActions } from "./overlay";

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

export function selectPageDock(config: PageConfig): DockPageConfig | null {
  const dock = config.dock;
  const title = dock?.title ?? config.title;
  if (!dock && title === undefined) return null;

  const slice: DockPageConfig = { ...(dock ?? {}) };
  if (title !== undefined) slice.title = title;

  const banner = slice.banner ?? slice.bannerUrl;
  if (isObject(banner)) {
    slice.bannerUrl = (banner.url ?? banner.bannerUrl) as string | undefined;
  } else if (banner !== undefined) {
    slice.bannerUrl = banner;
  }

  if (slice.isLoading === undefined) {
    const isLoading = pageLoadingFlag(config.loading);
    if (isLoading !== undefined) slice.isLoading = isLoading;
  }
  return slice;
}

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

export function openPageSurface(
  target: unknown,
  props: Record<string, unknown>,
  openSurface: DockActions["openSurface"],
): unknown {
  if (!target) return undefined;
  const candidate = target as { open?: (props: unknown) => unknown };
  if (typeof candidate.open === "function") return candidate.open(props);

  if (typeof target === "function") {
    try {
      const entry = (target as (props: unknown) => unknown)(props);
      if (isObject(entry) && (entry.component || entry.id || entry.render)) {
        return openSurface(entry as Parameters<typeof openSurface>[0]);
      }
    } catch {}
    return openSurface(
      createInlineSurfaceEntry({ component: target, props }) as Parameters<
        typeof openSurface
      >[0],
    );
  }

  if (typeof target === "object")
    return openSurface(target as Parameters<typeof openSurface>[0]);
  return undefined;
}

const NO_GUARD: DockPageGuard = Object.freeze({ when: false });
const NO_ACTIONS: NonNullable<DockPageConfig["actions"]> = Object.freeze(
  [],
) as unknown as NonNullable<DockPageConfig["actions"]>;

function useDockPage(
  slice: DockPageConfig | null,
  page: PageModuleApi,
): DockPageApi {
  const actions = useDockActions();
  useDockGuard(slice?.guard ?? NO_GUARD);
  useDockContextActions(slice?.actions ?? NO_ACTIONS);

  const surfacesRef = useRef(slice?.surfaces);
  useInsertionEffect(() => {
    surfacesRef.current = slice?.surfaces;
  }, [slice?.surfaces]);

  return useMemo(
    () => ({
      ...actions,
      set: (dock: DockPageConfig) => page.set({ dock }),
      surface: (
        surface: DockSurfaceSlot | string,
        props: Record<string, unknown> = {},
      ) =>
        openPageSurface(
          typeof surface === "string"
            ? surfacesRef.current?.[surface]
            : surface,
          props,
          actions.openSurface,
        ),
    }),
    [actions, page],
  );
}

statusActionDefaults.error = ErrorActions;
statusActionDefaults.guard = GuardActions;

function DockModuleProvider({ children }: { children?: ReactNode }) {
  return (
    <DockProvider notFoundAction={NotFoundActions}>{children}</DockProvider>
  );
}

export const dockModule = defineModule({
  id: "dock",
  context: DockContext,
  Provider: DockModuleProvider,
  Overlay: Dock,
  uses: ["loading", "media", "notification"],
  registry: {
    cleanupDelayMs: 600,
    keyPolicy: "path",
    lifecycle: "route",
    merge: mergeDockEntries,
    validate: validateDockEntry,
  },
  page: {
    select: selectPageDock,
    entries: toDockEntries,
    use: useDockPage,
  },
});

declare module "@omerdlw/base-framework/events" {
  interface FrameworkEventMap {
    DOCK_NAVIGATE: {
      from: string;
      item?: unknown;
      to: string;
      [key: string]: unknown;
    };
    DOCK_NOT_FOUND: {
      clear?: boolean;
      description?: string;
      icon?: ReactNode;
      path: string;
      title?: string;
      [key: string]: unknown;
    };
    DOCK_STATUS_SET: {
      action?: DockSlotContent | null;
      actions?: DockSlotContent | null;
      description?: string;
      duration?: number | null;
      flow?: string | null;
      icon?: ReactNode;
      isOverlay?: boolean;
      persist?: boolean;
      priority?: number | string | null;
      style?: DockStatusTheme;
      themeType?: string;
      title?: string;
      type?: string;
      [key: string]: unknown;
    };
    DOCK_STATUS_CLEAR: {
      flow?: string | null;
      type?: string;
      [key: string]: unknown;
    };
    DOCK_GUARD: {
      cancelText?: string;
      clear?: boolean;
      confirmText?: string;
      from?: string;
      icon?: ReactNode;
      message?: string;
      onCancel?: () => void;
      onConfirm?: () => void;
      title?: string;
      to?: string;
      when?: boolean;
      [key: string]: unknown;
    };
  }
}

declare module "@omerdlw/base-framework/kernel" {
  interface CoreModules {
    dock: typeof dockModule;
  }
  interface PageConfig {
    dock?: DockPageConfig | null;
  }
}
