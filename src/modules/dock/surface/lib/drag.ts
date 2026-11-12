import type { PanInfo } from "motion/react";

/** Elements that keep their own pointer handling and must not start a drag. */
export const SURFACE_DRAG_IGNORE_SELECTOR =
  'input, textarea, select, [role="slider"], [data-no-surface-drag], [data-lenis-prevent]';

/** True when a drag ended far or fast enough to dismiss the surface. */
export function isSwipeDismissGesture(
  info: PanInfo,
  dismiss: { offset: number; velocity: number },
) {
  return info.offset.y > dismiss.offset || info.velocity.y > dismiss.velocity;
}
