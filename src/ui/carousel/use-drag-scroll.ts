"use client";

import { type RefObject, useEffect } from "react";
import { DRAG_THRESHOLD } from "./track";

export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const track = ref.current;
    if (!track) return;
    let startX = 0;
    let startLeft = 0;
    let pressed = false;
    let dragged = false;

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      pressed = true;
      dragged = false;
      startX = event.clientX;
      startLeft = track.scrollLeft;
    };
    const onMove = (event: PointerEvent) => {
      if (!pressed) return;
      const delta = event.clientX - startX;
      if (!dragged && Math.abs(delta) > DRAG_THRESHOLD) {
        dragged = true;
        track.dataset.dragging = "true";
      }
      if (dragged) track.scrollLeft = startLeft - delta;
    };
    const onUp = () => {
      pressed = false;
      delete track.dataset.dragging;
    };
    const onClickCapture = (event: MouseEvent) => {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    };

    track.addEventListener("pointerdown", onDown);
    track.addEventListener("click", onClickCapture, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [ref]);
}
