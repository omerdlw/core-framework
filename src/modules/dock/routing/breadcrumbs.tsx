"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";

import { normalizePath } from "@/foundation/utils";
import { useRequiredContext } from "@/react/hooks";

import type {
  BreadcrumbConfig,
  BreadcrumbContextValue,
  BreadcrumbItem,
  BreadcrumbOverride,
  DefineBreadcrumbOptions,
  DockComponentProps,
  DockIconSource,
} from "../types";
import { formatSlugTitle } from "./model/policy";

const ROOT_BREADCRUMB_ID = "home";
const ROOT_BREADCRUMB_TITLE = "Home";
const DEFAULT_BREADCRUMB_ID = "breadcrumb";

function formatPath(path: string | null): string {
  return normalizePath(path) || "/";
}

function createRootBreadcrumb(
  root: Partial<BreadcrumbItem> | null | undefined,
  isCurrent: boolean,
): BreadcrumbItem {
  return {
    id: root?.id || ROOT_BREADCRUMB_ID,
    title: root?.title || ROOT_BREADCRUMB_TITLE,
    path: root?.path || "/",
    icon: root?.icon || null,
    isCurrent,
    level: 0,
  };
}

function createGenericBreadcrumbs(
  segments: string[],
  overrides: Record<string, BreadcrumbOverride>,
  resolveSegment?: BreadcrumbConfig["resolveSegment"],
): BreadcrumbItem[] {
  let currentPath = "";
  const results: BreadcrumbItem[] = [];
  const len = segments.length;

  for (let index = 0; index < len; index++) {
    const segment = segments[index];
    currentPath += `/${segment}`;

    const fallback: BreadcrumbItem = {
      id: `segment-${segment}-${index}`,
      title: formatSlugTitle(segment),
      path: currentPath,
      icon: null,
      isCurrent: index === len - 1,
      level: index + 1,
    };

    const resolvedSegment = resolveSegment
      ? resolveSegment({ ...fallback, index, segment, segments })
      : null;
    const override = overrides[currentPath];

    results.push(
      Object.assign(
        fallback,
        resolvedSegment && typeof resolvedSegment === "object"
          ? resolvedSegment
          : null,
        override || null,
      ),
    );
  }
  return results;
}

function resolveRouteBreadcrumbs(
  pathname = "",
  overrides: Record<string, BreadcrumbOverride> = {},
  config: BreadcrumbConfig = {},
): BreadcrumbItem[] {
  const normalizedPath = normalizePath(pathname) || "/";
  const rootBreadcrumb = createRootBreadcrumb(
    config.root,
    normalizedPath === "/",
  );

  if (normalizedPath === "/") return [rootBreadcrumb];

  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length === 0) return [rootBreadcrumb];

  if (typeof config.resolvePath === "function") {
    const resolvedPath = config.resolvePath({
      overrides,
      pathname: normalizedPath,
      root: rootBreadcrumb,
      segments,
    });
    if (Array.isArray(resolvedPath)) {
      return [rootBreadcrumb, ...resolvedPath];
    }
  }

  const generated = createGenericBreadcrumbs(
    segments,
    overrides,
    config.resolveSegment,
  );

  generated.unshift(rootBreadcrumb);
  return generated;
}

type BreadcrumbOverrides = Record<string, BreadcrumbOverride>;

function withBreadcrumbOverride(
  currentOverrides: BreadcrumbOverrides,
  normalizedPath: string,
  overrideConfig: BreadcrumbOverride,
): BreadcrumbOverrides {
  const existing = currentOverrides[normalizedPath];
  if (
    existing?.title === overrideConfig.title &&
    existing?.icon === overrideConfig.icon
  ) {
    return currentOverrides;
  }
  return {
    ...currentOverrides,
    [normalizedPath]: {
      title: overrideConfig.title || null,
      icon: overrideConfig.icon || null,
    },
  };
}

function withoutBreadcrumbOverride(
  currentOverrides: BreadcrumbOverrides,
  normalizedPath: string,
): BreadcrumbOverrides {
  if (!currentOverrides[normalizedPath]) return currentOverrides;
  const { [normalizedPath]: _, ...nextOverrides } = currentOverrides;
  return nextOverrides;
}

const EMPTY_BREADCRUMB_CONFIG: BreadcrumbConfig = {};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

/** Override actions; built once per provider so consumer effects stay put. */
function createBreadcrumbActions(
  setOverrides: Dispatch<SetStateAction<BreadcrumbOverrides>>,
): BreadcrumbContextValue["actions"] {
  return {
    registerOverride(path: string, overrideConfig: BreadcrumbOverride) {
      if (!path || !overrideConfig) return;
      const normalizedPath = formatPath(path);
      setOverrides((currentOverrides) =>
        withBreadcrumbOverride(
          currentOverrides,
          normalizedPath,
          overrideConfig,
        ),
      );
    },
    unregisterOverride(path: string) {
      if (!path) return;
      const normalizedPath = formatPath(path);
      setOverrides((currentOverrides) =>
        withoutBreadcrumbOverride(currentOverrides, normalizedPath),
      );
    },
  };
}

export function BreadcrumbProvider({
  children,
  config = null,
}: {
  children?: ReactNode;
  config?: BreadcrumbConfig | null;
}) {
  const [overrides, setOverrides] = useState<BreadcrumbOverrides>({});

  const [actions] = useState(() => createBreadcrumbActions(setOverrides));

  // stable identity: consumers subscribe by reference
  const value = useMemo<BreadcrumbContextValue>(
    () => ({
      actions,
      config: config || EMPTY_BREADCRUMB_CONFIG,
      overrides,
    }),
    [actions, config, overrides],
  );

  return <BreadcrumbContext value={value}>{children}</BreadcrumbContext>;
}

function useBreadcrumbActions() {
  return useRequiredContext(
    BreadcrumbContext,
    "useBreadcrumbActions",
    "BreadcrumbProvider",
  ).actions;
}

export function useDockBreadcrumbs() {
  const pathname = usePathname();
  const router = useRouter();
  const { config, overrides } = useRequiredContext(
    BreadcrumbContext,
    "useDockBreadcrumbs",
    "BreadcrumbProvider",
  );

  const breadcrumbs = resolveRouteBreadcrumbs(
    pathname || "",
    overrides,
    config || {},
  );

  const len = breadcrumbs.length;
  const current = len > 0 ? breadcrumbs[len - 1] : null;
  const parent = len > 1 ? breadcrumbs[len - 2] : null;
  const canGoBack = len > 1;

  const goBack = () => {
    if (parent?.path) router.push(parent.path);
    else router.back();
  };

  return { breadcrumbs, canGoBack, current, goBack, parent };
}

export function useRegisterBreadcrumbOverride({
  icon = null,
  path,
  title = null,
}: {
  icon?: DockIconSource;
  path?: string;
  title?: string | null;
} = {}) {
  const { registerOverride, unregisterOverride } = useBreadcrumbActions();

  useEffect(() => {
    if (!path || (!title && !icon)) return;

    registerOverride(path, { title, icon });
    return () => unregisterOverride(path);
  }, [icon, path, registerOverride, title, unregisterOverride]);
}

/**
 * Defines a breadcrumb override for a path. `create` builds the override from
 * props, and `use()` registers it for the lifetime of the calling component.
 */
export function defineBreadcrumb(definition: DefineBreadcrumbOptions = {}) {
  const { icon = null, path = null, title = null, ...extraConfig } = definition;

  const createOverride = (
    props: DockComponentProps = {},
    overrides: Partial<BreadcrumbOverride> & { path?: string | null } = {},
  ): BreadcrumbOverride & { path?: string | null; [key: string]: unknown } => {
    const resolvedTitle = typeof title === "function" ? title(props) : title;
    const resolvedIcon = typeof icon === "function" ? icon(props) : icon;
    return {
      icon: overrides.icon ?? resolvedIcon,
      path: overrides.path ?? path,
      title: overrides.title ?? resolvedTitle,
      ...extraConfig,
      ...overrides,
    };
  };

  const useDefinedBreadcrumb = (
    props: DockComponentProps = {},
    overrides: Partial<BreadcrumbOverride> & { path?: string | null } = {},
  ) => {
    const pathname = usePathname();
    const activePath = overrides.path || path || pathname;
    const override = createOverride(props, { ...overrides, path: activePath });
    useRegisterBreadcrumbOverride({
      ...override,
      path: override.path ?? undefined,
    });
  };

  return Object.freeze({
    config: { icon, path, title, ...extraConfig },
    create: createOverride,
    id: path || DEFAULT_BREADCRUMB_ID,
    use: useDefinedBreadcrumb,
  });
}

export function useDockBreadcrumbsCardModel(_props: {
  className?: string;
  maxItems?: number;
  onNavigate?: (href: string) => unknown;
}) {
  const { breadcrumbs } = useDockBreadcrumbs();

  return { breadcrumbs };
}
