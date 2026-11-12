import { isPlainObject } from "@/foundation/utils";

import {
  HEIGHT_CONSTRAINT_PATTERN,
  MODAL_BREAKPOINTS,
  MODAL_POSITIONS,
} from "../constants";
import {
  type ModalLayout,
  type ModalPosition,
  type ResponsiveModalPosition,
} from "../types";

/**
 * Whether a class name already sets a height or max-height.
 */
export function hasHeightConstraint(className?: string): boolean {
  return (
    typeof className === "string" && HEIGHT_CONSTRAINT_PATTERN.test(className)
  );
}

/**
 * Whether a position is the left or right edge.
 */
export function isSidePosition(
  position: ModalPosition | null | undefined,
): boolean {
  return (
    position === MODAL_POSITIONS.LEFT || position === MODAL_POSITIONS.RIGHT
  );
}

/**
 * Whether a position is the top or bottom edge.
 */
export function isVerticalEdgePosition(
  position: ModalPosition | null | undefined,
): boolean {
  return (
    position === MODAL_POSITIONS.TOP || position === MODAL_POSITIONS.BOTTOM
  );
}

/**
 * Narrows a position to a supported one, falling back to center.
 */
export function getModalPosition(position: ModalPosition): ModalPosition {
  return position === MODAL_POSITIONS.TOP ||
    position === MODAL_POSITIONS.BOTTOM ||
    position === MODAL_POSITIONS.LEFT ||
    position === MODAL_POSITIONS.RIGHT
    ? position
    : MODAL_POSITIONS.CENTER;
}
/**
 * Layout of a modal for a position, switching to the mobile variants on small screens.
 */
export function getModalLayout(
  position: ModalPosition,
  isMobile: boolean,
): ModalLayout {
  const resolved = getModalPosition(position);
  if (!isMobile) return resolved;
  if (resolved === MODAL_POSITIONS.TOP || resolved === MODAL_POSITIONS.BOTTOM)
    return `${resolved}-mobile`;
  if (resolved === MODAL_POSITIONS.LEFT || resolved === MODAL_POSITIONS.RIGHT)
    return "side-mobile";
  return resolved;
}

/**
 * Whether the viewport is in the mobile range now. False on the server.
 */
export function getViewportIsMobile(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia(
    `(max-width: ${MODAL_BREAKPOINTS.MOBILE_MAX_WIDTH}px)`,
  ).matches;
}

/**
 * Picks the position that applies on the current viewport from a responsive map.
 */
export function resolveActivePosition(
  position: ModalPosition,
  responsivePosition: ResponsiveModalPosition | null | undefined,
  isMobileViewport: boolean,
): ModalPosition {
  if (!isPlainObject(responsivePosition)) return position;
  const responsive = isMobileViewport
    ? responsivePosition.mobile
    : responsivePosition.desktop;
  return (responsive || position) as ModalPosition;
}

/**
 * Splits a position option into the base position and its optional responsive map.
 */
export function normalizePosition(
  input: ModalPosition | ResponsiveModalPosition | undefined,
): {
  position: ModalPosition;
  responsivePosition: ResponsiveModalPosition | null;
} {
  if (typeof input === "string") {
    return { position: input, responsivePosition: null };
  }
  if (!isPlainObject(input)) {
    return { position: MODAL_POSITIONS.CENTER, responsivePosition: null };
  }
  return {
    position: resolveActivePosition(
      MODAL_POSITIONS.CENTER,
      input,
      getViewportIsMobile(),
    ),
    responsivePosition: input,
  };
}
