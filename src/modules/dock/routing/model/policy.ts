import { isSafeInternalHref } from "../../model/paths";
import type {
  DockItem,
  DockRoutePolicy,
  DockRoutePolicyOverrides,
} from "../../types";

function getRoutePolicyOverrides(
  item: DockItem | null | undefined,
): DockRoutePolicyOverrides {
  return item?.dockPolicy && typeof item.dockPolicy === "object"
    ? item.dockPolicy
    : {};
}

function resolvePolicyBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function resolveDockRoutePolicy({
  href,
  item = null,
}: { href?: string; item?: DockItem | null } = {}): DockRoutePolicy {
  const overrides = getRoutePolicyOverrides(item);
  const canNavigate = isSafeInternalHref(href);
  const canPrefetch =
    canNavigate &&
    !item?.isLoading &&
    !item?.isOverlay &&
    !item?.isSurface &&
    !item?.prefetchDisabled;

  return {
    canNavigate,
    clearTransientState: resolvePolicyBoolean(
      overrides.clearTransientState,
      true,
    ),
    dismissSurfaces: resolvePolicyBoolean(overrides.dismissSurfaces, true),
    prefetch:
      resolvePolicyBoolean(overrides.prefetch, canPrefetch) && canPrefetch,
  };
}

export function formatSlugTitle(slug = ""): string {
  if (!slug) return "";
  return String(slug)
    .split(/[-_]+/)
    .map((word) =>
      word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : "",
    )
    .filter(Boolean)
    .join(" ");
}
