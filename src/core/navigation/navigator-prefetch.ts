import { report } from "@/foundation/utils";
import type { getNavigationSettings } from "./settings";
import type {
  NavigationIntentListener,
  NavigationPrefetchOptions,
  NavigationRouter,
} from "./types";
import { isSafeInternalHref, locationKeyOf, pathOf } from "./utils";

export function createPrefetcher({
  getRouter,
  now,
  settings,
}: {
  getRouter: () => NavigationRouter | null;
  now: () => number;
  settings: typeof getNavigationSettings;
}) {
  const warmed = new Map<string, number>();
  const intentListeners = new Set<NavigationIntentListener>();

  function prefetch(
    href: string,
    { force = false, kind }: NavigationPrefetchOptions = {},
  ): boolean {
    const router = getRouter();
    if (!isSafeInternalHref(href) || typeof router?.prefetch !== "function")
      return false;
    const key = locationKeyOf(href.split("#")[0]);
    const at = warmed.get(key);
    if (!force && at !== undefined && now() - at < settings().prefetchTtlMs)
      return false;
    warmed.set(key, now());
    for (const listener of intentListeners) {
      try {
        listener(pathOf(href), href);
      } catch (error) {
        report("Navigation intent listener", error);
      }
    }
    try {
      router.prefetch(href, {
        kind: kind ?? settings().prefetchKind,
        onInvalidate: () => {
          if (warmed.get(key) !== undefined) warmed.delete(key);
        },
      });
      return true;
    } catch (error) {
      warmed.delete(key);
      report("Navigation prefetch", error, "warn");
      return false;
    }
  }

  function onIntent(listener: NavigationIntentListener): () => void {
    intentListeners.add(listener);
    return () => {
      intentListeners.delete(listener);
    };
  }

  return { onIntent, prefetch };
}
