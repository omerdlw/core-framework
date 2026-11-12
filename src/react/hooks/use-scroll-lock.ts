"use client";

import { useEffect } from "react";
export const SCROLL_LOCK = "data-scroll-lock";

let holds = 0;
let startY = 0;

const listener = { capture: true, passive: false } as const;

function canScroll(target: EventTarget | null, delta: number) {
  let element = target instanceof Element ? target : null;
  while (
    element &&
    element !== document.body &&
    element !== document.documentElement
  ) {
    if (
      element instanceof HTMLElement &&
      element.scrollHeight > element.clientHeight + 1
    ) {
      const { overflowY } = getComputedStyle(element);
      if (
        overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay"
      ) {
        const atTop = element.scrollTop <= 0;
        const atEnd =
          element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
        return delta === 0 || (delta < 0 && !atTop) || (delta > 0 && !atEnd);
      }
    }
    element = element.parentElement;
  }
  return false;
}

function onWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) return;
  const delta = event.deltaY || event.deltaX;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    event.preventDefault();
    return;
  }
  if (!canScroll(event.target, delta)) event.preventDefault();
}

function onTouchStart(event: TouchEvent) {
  startY = event.touches[0]?.clientY ?? 0;
}

function onTouchMove(event: TouchEvent) {
  if (event.touches.length > 1) return;
  const y = event.touches[0]?.clientY ?? startY;
  if (!canScroll(event.target, startY - y)) event.preventDefault();
}

function hold() {
  if (holds++ > 0) return;
  document.documentElement.setAttribute(SCROLL_LOCK, "");
  window.addEventListener("wheel", onWheel, listener);
  window.addEventListener("touchstart", onTouchStart, {
    capture: true,
    passive: true,
  });
  window.addEventListener("touchmove", onTouchMove, listener);
}

function release() {
  if (--holds > 0) return;
  holds = 0;
  document.documentElement.removeAttribute(SCROLL_LOCK);
  window.removeEventListener("wheel", onWheel, listener);
  window.removeEventListener("touchstart", onTouchStart, { capture: true });
  window.removeEventListener("touchmove", onTouchMove, listener);
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    hold();
    return release;
  }, [active]);
}
