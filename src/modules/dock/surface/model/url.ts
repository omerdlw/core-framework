import { report } from "@/foundation/utils";

import type {
  DockSurfaceHistoryState,
  SurfaceStackEntry,
  SurfaceUrlState,
} from "../../types";

type SurfaceUrlSource = Pick<
  SurfaceStackEntry,
  "flow" | "syncWithUrl" | "urlKey"
>;

export const SURFACE_URL_PARAM = "surface";
const DEFAULT_SURFACE_URL_VALUE = "open";

export const IS_BROWSER = typeof window !== "undefined";

/** URL value a surface writes to the `surface` query parameter. */
export function getSurfaceUrlValue(
  surfaceEntry: SurfaceUrlSource | null | undefined,
): string {
  return typeof surfaceEntry?.syncWithUrl === "string"
    ? surfaceEntry.syncWithUrl
    : surfaceEntry?.urlKey || DEFAULT_SURFACE_URL_VALUE;
}

function createSurfaceHistoryState(
  surfaceEntry: SurfaceUrlSource,
): DockSurfaceHistoryState {
  const value = getSurfaceUrlValue(surfaceEntry);
  const flow = surfaceEntry?.flow;
  return {
    value,
    ...(flow ? { flow: { id: flow.flowId, snapshot: flow.snapshot } } : {}),
  };
}

function isUrlSynced(surfaceEntry: SurfaceUrlSource | null | undefined) {
  return Boolean(surfaceEntry?.syncWithUrl || surfaceEntry?.urlKey);
}

/** True when the URL's surface parameter no longer matches the entry. */
export function isSurfaceUrlOutOfSync(surfaceEntry: SurfaceUrlSource) {
  return (
    new URL(window.location.href).searchParams.get(SURFACE_URL_PARAM) !==
    getSurfaceUrlValue(surfaceEntry)
  );
}

function rewindSurfaceUrl(url: URL, urlState: SurfaceUrlState | null) {
  if (
    urlState?.value &&
    url.searchParams.get(SURFACE_URL_PARAM) !== urlState.value
  )
    return;
  if (urlState?.previousValue)
    url.searchParams.set(SURFACE_URL_PARAM, urlState.previousValue);
  else url.searchParams.delete(SURFACE_URL_PARAM);

  const state = {
    ...(window.history.state as { dockSurface?: { value?: unknown } } | null),
  };
  if (state.dockSurface?.value === urlState?.value) delete state.dockSurface;
  window.history.replaceState(state, "", url.toString());
}

/** Pushes (opening) or rewinds (closing) the URL entry of a synced surface. */
export function syncSurfaceUrl(
  surfaceEntry: SurfaceUrlSource,
  isOpening: boolean,
  urlState: SurfaceUrlState | null = null,
) {
  if (!IS_BROWSER || !isUrlSynced(surfaceEntry)) return;
  try {
    const url = new URL(window.location.href);
    if (isOpening) {
      const value = getSurfaceUrlValue(surfaceEntry);
      if (urlState)
        urlState.previousValue = url.searchParams.get(SURFACE_URL_PARAM);
      url.searchParams.set(SURFACE_URL_PARAM, value);
      window.history.pushState(
        {
          ...window.history.state,
          dockSurface: createSurfaceHistoryState(surfaceEntry),
        },
        "",
        url.toString(),
      );
      return;
    }
    rewindSurfaceUrl(url, urlState);
  } catch (error) {
    report("Dock surface URL sync", error, "warn");
  }
}

/** Refreshes the history entry of an open synced surface after its flow changes. */
export function syncSurfaceFlowUrlState(
  surfaceEntry: SurfaceUrlSource,
  urlState: SurfaceUrlState | null = null,
) {
  if (!IS_BROWSER || !isUrlSynced(surfaceEntry)) return;
  try {
    const url = new URL(window.location.href);
    const value = getSurfaceUrlValue(surfaceEntry);
    if (
      url.searchParams.get(SURFACE_URL_PARAM) !== value ||
      urlState?.value !== value
    )
      return;
    window.history.replaceState(
      {
        ...window.history.state,
        dockSurface: createSurfaceHistoryState(surfaceEntry),
      },
      "",
      url.toString(),
    );
  } catch (error) {
    report("Dock surface flow URL sync", error, "warn");
  }
}
