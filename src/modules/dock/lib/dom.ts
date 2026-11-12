import {
  DOCK_FOCUS_RESTORE_BLOCKED_REASONS,
  DOCK_FOCUSABLE_SELECTOR,
} from "../constants";

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
  return Array.from(
    container.querySelectorAll<HTMLElement>(DOCK_FOCUSABLE_SELECTOR),
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
