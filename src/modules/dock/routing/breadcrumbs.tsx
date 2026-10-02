"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { normalizePath } from "@/utils";
import { useRequiredContext } from "@/hooks";
import { formatSlugTitle } from "./navigation";
import {
  type BreadcrumbConfig,
  type BreadcrumbContextValue,
  type BreadcrumbItem,
  type BreadcrumbOverride,
  type DockIconSource,
  type DefineBreadcrumbOptions,
  type DockComponentProps,
} from "../types";

function formatPath(path: string | null): string {
  return normalizePath(path) || "/";
}

function createRootBreadcrumb(
  root: Partial<BreadcrumbItem> | null | undefined,
  isCurrent: boolean,
): BreadcrumbItem {
  return {
    id: root?.id || "home",
    title: root?.title || "Home",
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

const EMPTY_BREADCRUMB_CONFIG: BreadcrumbConfig = {};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({
  children,
  config = null,
}: {
  children?: ReactNode;
  config?: BreadcrumbConfig | null;
}) {
  const [overrides, setOverrides] = useState<
    Record<string, BreadcrumbOverride>
  >({});

  const registerOverride = useCallback(
    (path: string, overrideConfig: BreadcrumbOverride) => {
      if (!path || !overrideConfig) return;
      const normalizedPath = formatPath(path);

      setOverrides((currentOverrides) => {
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
      });
    },
    [],
  );

  const unregisterOverride = useCallback((path: string) => {
    if (!path) return;
    const normalizedPath = formatPath(path);

    setOverrides((currentOverrides) => {
      if (!currentOverrides[normalizedPath]) return currentOverrides;
      const { [normalizedPath]: _, ...nextOverrides } = currentOverrides;
      return nextOverrides;
    });
  }, []);

  const value = useMemo<BreadcrumbContextValue>(
    () => ({
      actions: { registerOverride, unregisterOverride },
      config: config || EMPTY_BREADCRUMB_CONFIG,
      overrides,
    }),
    [config, overrides, registerOverride, unregisterOverride],
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

  const breadcrumbs = useMemo(
    () => resolveRouteBreadcrumbs(pathname || "", overrides, config || {}),
    [config, pathname, overrides],
  );

  const len = breadcrumbs.length;
  const current = len > 0 ? breadcrumbs[len - 1] : null;
  const parent = len > 1 ? breadcrumbs[len - 2] : null;
  const canGoBack = len > 1;

  const goBack = useCallback(() => {
    if (parent?.path) router.push(parent.path);
    else router.back();
  }, [parent, router]);

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
    id: path || "breadcrumb",
    use: useDefinedBreadcrumb,
  });
}

export function useDockBreadcrumbsCardModel({
  className = "",
  maxItems = 4,
  onNavigate,
}: {
  className?: string;
  maxItems?: number;
  onNavigate?: (href: string) => unknown;
}) {
  const { breadcrumbs } = useDockBreadcrumbs();

  return { breadcrumbs };
}
