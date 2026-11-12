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

export const IS_BROWSER = typeof window !== "undefined";

export function getSurfaceUrlValue(
  surfaceEntry: SurfaceUrlSource | null | undefined,
): string {
  return typeof surfaceEntry?.syncWithUrl === "string"
    ? surfaceEntry.syncWithUrl
    : surfaceEntry?.urlKey || "open";
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

export function syncSurfaceUrl(
  surfaceEntry: SurfaceUrlSource,
  isOpening: boolean,
  urlState: SurfaceUrlState | null = null,
) {
  if (!IS_BROWSER || (!surfaceEntry?.syncWithUrl && !surfaceEntry?.urlKey))
    return;
  try {
    const url = new URL(window.location.href);
    if (isOpening) {
      const value = getSurfaceUrlValue(surfaceEntry);
      if (urlState) urlState.previousValue = url.searchParams.get("surface");
      url.searchParams.set("surface", value);
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
    if (urlState?.value && url.searchParams.get("surface") !== urlState.value)
      return;
    if (urlState?.previousValue)
      url.searchParams.set("surface", urlState.previousValue);
    else url.searchParams.delete("surface");

    const state = {
      ...(window.history.state as { dockSurface?: { value?: unknown } } | null),
    };
    if (state.dockSurface?.value === urlState?.value) delete state.dockSurface;
    window.history.replaceState(state, "", url.toString());
  } catch (error) {
    report("Dock surface URL sync", error, "warn");
  }
}

export function syncSurfaceFlowUrlState(
  surfaceEntry: SurfaceUrlSource,
  urlState: SurfaceUrlState | null = null,
) {
  if (!IS_BROWSER || (!surfaceEntry?.syncWithUrl && !surfaceEntry?.urlKey))
    return;
  try {
    const url = new URL(window.location.href);
    const value = getSurfaceUrlValue(surfaceEntry);
    if (url.searchParams.get("surface") !== value || urlState?.value !== value)
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
