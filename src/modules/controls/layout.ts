import { clamp } from "@/foundation/utils";

import {
  CONTROLS_ANCHOR_SELECTOR,
  CONTROLS_DOCK_ELEMENT_ID,
  CONTROLS_DOCK_GAP,
  CONTROLS_EDGE_INSET,
} from "./constants";
import { type ControlsLayout, type ViewportDimensions } from "./types";

/**
 * Computes the left and right rail geometry from the dock rectangle and
 * viewport. Returns null when it cannot be measured.
 */
export function getControlsLayout(
  dockRect: Pick<DOMRect, "bottom" | "height" | "left" | "right"> | null,
  viewport: ViewportDimensions,
): ControlsLayout | null {
  const { height, width } = viewport;
  if (!dockRect || width <= 0 || height <= 0) return null;

  const inset = CONTROLS_EDGE_INSET;
  const gap = CONTROLS_DOCK_GAP;
  const dockLeft = clamp(dockRect.left, 0, width);
  const dockRight = clamp(dockRect.right, dockLeft, width);
  const dockBottom = clamp(dockRect.bottom, 0, height);

  return {
    bottom: Math.max(0, height - dockBottom),
    height: Math.max(0, dockRect.height) / 2,
    left: {
      maxWidth: Math.max(0, dockLeft - inset * 2 - gap),
      right: Math.max(inset, width - dockLeft + gap),
    },
    right: {
      left: Math.min(width - inset, dockRight + gap),
      maxWidth: Math.max(0, width - dockRight - inset * 2 - gap),
    },
  };
}

/**
 * Whether two layouts have the same geometry.
 */
export function areLayoutsEqual(
  a: ControlsLayout | null,
  b: ControlsLayout | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.bottom === b.bottom &&
    a.height === b.height &&
    a.isHidden === b.isHidden &&
    a.left.maxWidth === b.left.maxWidth &&
    a.left.right === b.left.right &&
    a.right.left === b.right.left &&
    a.right.maxWidth === b.right.maxWidth
  );
}

/**
 * The dock card stack element, if mounted.
 */
export function getDockStackElement(): HTMLElement | null {
  return document.getElementById(CONTROLS_DOCK_ELEMENT_ID);
}

/**
 * The element controls anchor to: an explicit anchor, or the dock card stack.
 */
export function getDockElement(): Element | null {
  return (
    document.querySelector(CONTROLS_ANCHOR_SELECTOR) ?? getDockStackElement()
  );
}

/**
 * Measures the current layout from the DOM, or returns null when there is no
 * dock.
 */
export function measureLayout(): ControlsLayout | null {
  const dockElement = getDockElement();
  if (!dockElement) return null;
  const layout = getControlsLayout(dockElement.getBoundingClientRect(), {
    height: window.innerHeight,
    width: window.innerWidth,
  });
  return (
    layout && {
      ...layout,
      isHidden: getDockStackElement()?.dataset.controlsHidden === "true",
    }
  );
}
