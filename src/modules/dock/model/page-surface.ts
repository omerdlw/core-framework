import { isObject } from "@/foundation/utils";

import { createInlineSurfaceEntry } from "../surface/definition";
import type { DockActions } from "../types";

/** Opens a surface given as a handle, factory, descriptor or node from a page. */
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
