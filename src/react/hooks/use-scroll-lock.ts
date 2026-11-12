"use client";

import { useEffect } from "react";
/**
 * The attribute set on the root element while page scrolling is locked.
 */
export const SCROLL_LOCK = "data-scroll-lock";

let holds = 0;
let startY = 0;

const listener = { capture: true, passive: false } as const;

// Sub-pixel rounding makes scroll metrics off by one at the edges.
const SCROLL_EDGE_TOLERANCE_PX = 1;
const SCROLLABLE_OVERFLOW = new Set(["auto", "scroll", "overlay"]);

function isScrollContainer(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.scrollHeight <= element.clientHeight + SCROLL_EDGE_TOLERANCE_PX) {
    return false;
  }
  return SCROLLABLE_OVERFLOW.has(getComputedStyle(element).overflowY);
}

function canScrollFurther(element: HTMLElement, delta: number): boolean {
  const atTop = element.scrollTop <= 0;
  const atEnd =
    element.scrollTop + element.clientHeight >=
    element.scrollHeight - SCROLL_EDGE_TOLERANCE_PX;
  return delta === 0 || (delta < 0 && !atTop) || (delta > 0 && !atEnd);
}

/** True when the nearest scroll container under `target` can still move in the direction of `delta`. */
function canScroll(target: EventTarget | null, delta: number): boolean {
  let element = target instanceof Element ? target : null;
  while (
    element &&
    element !== document.body &&
    element !== document.documentElement
  ) {
    if (isScrollContainer(element)) return canScrollFurther(element, delta);
    element = element.parentElement;
  }
  return false;
}

function onWheel(event: WheelEvent): void {
  if (event.ctrlKey || event.metaKey) return;
  const delta = event.deltaY || event.deltaX;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    event.preventDefault();
    return;
  }
  if (!canScroll(event.target, delta)) event.preventDefault();
}

function onTouchStart(event: TouchEvent): void {
  startY = event.touches[0]?.clientY ?? 0;
}

function onTouchMove(event: TouchEvent): void {
  if (event.touches.length > 1) return;
  const y = event.touches[0]?.clientY ?? startY;
  if (!canScroll(event.target, startY - y)) event.preventDefault();
}

function hold(): void {
  if (holds++ > 0) return;
  document.documentElement.setAttribute(SCROLL_LOCK, "");
  window.addEventListener("wheel", onWheel, listener);
  window.addEventListener("touchstart", onTouchStart, {
    capture: true,
    passive: true,
  });
  window.addEventListener("touchmove", onTouchMove, listener);
}

function release(): void {
  if (--holds > 0) return;
  holds = 0;
  document.documentElement.removeAttribute(SCROLL_LOCK);
  window.removeEventListener("wheel", onWheel, listener);
  window.removeEventListener("touchstart", onTouchStart, { capture: true });
  window.removeEventListener("touchmove", onTouchMove, listener);
}

/**
 * Locks page scrolling while `active` is true; nested locks are counted.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    hold();
    return release;
  }, [active]);
}
