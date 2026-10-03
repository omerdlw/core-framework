import { isPlainObject } from "@/utils";
import {
  HEIGHT_CONSTRAINT_PATTERN,
  MODAL_BREAKPOINTS,
  MODAL_POSITIONS,
} from "./constants";
import {
  type ModalLayout,
  type ModalPosition,
  type ResponsiveModalPosition,
} from "./types";

export function hasHeightConstraint(className?: string): boolean {
  return (
    typeof className === "string" && HEIGHT_CONSTRAINT_PATTERN.test(className)
  );
}

export function isSidePosition(
  position: ModalPosition | null | undefined,
): boolean {
  return (
    position === MODAL_POSITIONS.LEFT || position === MODAL_POSITIONS.RIGHT
  );
}

export function isVerticalEdgePosition(
  position: ModalPosition | null | undefined,
): boolean {
  return (
    position === MODAL_POSITIONS.TOP || position === MODAL_POSITIONS.BOTTOM
  );
}

export function getModalPosition(position: ModalPosition): ModalPosition {
  return position === MODAL_POSITIONS.TOP ||
    position === MODAL_POSITIONS.BOTTOM ||
    position === MODAL_POSITIONS.LEFT ||
    position === MODAL_POSITIONS.RIGHT
    ? position
    : MODAL_POSITIONS.CENTER;
}
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
