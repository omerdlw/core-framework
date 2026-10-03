"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from "react";
import {
  DOCK_FOCUSABLE_SELECTOR,
  DOCK_FOCUS_RESTORE_BLOCKED_REASONS,
} from "./constants";
import { type DockActions, type DockItem } from "./types";

export function blurActiveElement(): void {
  if (typeof document === "undefined") return;
  const activeElement = document.activeElement as HTMLElement | null;
  if (activeElement && typeof activeElement.blur === "function") {
    activeElement.blur();
  }
}

function closestMatches(target: unknown, selector: string): boolean {
  const element = target as Partial<Element> | null | undefined;
  return Boolean(
    element &&
    typeof element.closest === "function" &&
    element.closest(selector),
  );
}

export function isInteractiveTarget(target: unknown): boolean {
  return closestMatches(
    target,
    'button, a, input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])',
  );
}

export function isEditableDockTarget(target: unknown): boolean {
  return closestMatches(
    target,
    'input, textarea, select, [contenteditable="true"]',
  );
}

export function getDockFocusableElements(
  container: HTMLElement | null,
): HTMLElement[] {
  if (!container || typeof container.querySelectorAll !== "function") return [];
  return (
    Array.from(
      container.querySelectorAll(DOCK_FOCUSABLE_SELECTOR),
    ) as HTMLElement[]
  ).filter((element) => {
    if (!element || element.getAttribute("aria-hidden") === "true")
      return false;
    const style =
      typeof window !== "undefined" ? window.getComputedStyle(element) : null;
    return (
      style?.display !== "none" &&
      style?.visibility !== "hidden" &&
      style?.pointerEvents !== "none"
    );
  });
}

export function focusDockElement(element: HTMLElement | null): boolean {
  if (!element || typeof element.focus !== "function") return false;
  try {
    element.focus({ preventScroll: true });
    return document.activeElement === element;
  } catch {
    return false;
  }
}

export function shouldRestoreDockFocus(result: unknown): boolean {
  const blockedReason = (result as { blockedReason?: unknown } | null)
    ?.blockedReason;
  return (
    !result ||
    !(DOCK_FOCUS_RESTORE_BLOCKED_REASONS as readonly unknown[]).includes(
      blockedReason,
    )
  );
}

export function useDockFocusTrap({
  containerRef,
  enabled = true,
  onDismiss = null,
}: {
  containerRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
  onDismiss?: (() => void) | null;
}) {
  const hasAutoFocusedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      hasAutoFocusedRef.current = false;
      return;
    }

    const container = containerRef?.current;
    if (!container) return;

    const focusFrameId = window.requestAnimationFrame(() => {
      if (hasAutoFocusedRef.current) return;
      hasAutoFocusedRef.current = true;

      const preferredTarget = container.querySelector("[data-dock-autofocus]");
      const target =
        preferredTarget instanceof HTMLElement
          ? preferredTarget
          : getDockFocusableElements(container)[0] || container;
      focusDockElement(target);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        typeof onDismiss === "function"
      ) {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getDockFocusableElements(container);
      if (focusableElements.length === 0) {
        event.preventDefault();
        focusDockElement(container);
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        focusDockElement(lastElement);
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        focusDockElement(firstElement);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || container.contains(target)) return;

      if (
        target instanceof Element &&
        target.closest('[role="dialog"][aria-modal="true"]')
      ) {
        return;
      }

      const firstElement = getDockFocusableElements(container)[0] || container;
      focusDockElement(firstElement);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      window.cancelAnimationFrame(focusFrameId);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [containerRef, enabled, onDismiss]);
}

export function useDockKeyboard({
  expanded,
  focusedIndex,
  isOverlayActive,
  navigate,
  dockItems,
  setExpanded,
  setFocusedIndex,
}: {
  expanded: boolean;
  focusedIndex: number;
  isOverlayActive: boolean;
  navigate: DockActions["navigate"];
  dockItems: DockItem[];
  setExpanded: (expanded: boolean) => void;
  setFocusedIndex: (update: number | ((current: number) => number)) => void;
}) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        isEditableDockTarget(event.target) ||
        isInteractiveTarget(event.target)
      ) {
        return;
      }
      if (isOverlayActive || !expanded) return;

      const { key } = event;
      if (key === "Escape") {
        event.preventDefault();
        setExpanded(false);
        return;
      }
      if (key === "Enter" && focusedIndex !== -1) {
        event.preventDefault();
        const focusedItem = dockItems[focusedIndex];
        if (focusedItem?.path) {
          navigate(focusedItem.path, { item: focusedItem });
        }
        return;
      }

      if (dockItems.length === 0) return;

      if (key === "ArrowDown") {
        event.preventDefault();
        setFocusedIndex((current) =>
          current < dockItems.length - 1 ? current + 1 : 0,
        );
        return;
      }
      if (key === "ArrowUp") {
        event.preventDefault();
        setFocusedIndex((current) =>
          current > 0 ? current - 1 : dockItems.length - 1,
        );
      }
    },
    [
      expanded,
      focusedIndex,
      isOverlayActive,
      navigate,
      dockItems,
      setExpanded,
      setFocusedIndex,
    ],
  );

  useEffect(() => {
    if (!expanded) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded, handleKeyDown]);
}

export function useDockRouteReset(
  pathname: string | null,
  onRouteChange?: (path: string | null) => void,
) {
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    onRouteChange?.(pathname);
  }, [onRouteChange, pathname]);
}
