"use client";

import { animate } from "motion/react";
import {
  Children,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { type RefObject } from "react";

import type {
  CarouselProps,
  CarouselSlideProps,
  ScrollState,
} from "@/react/ui/types";

import { useUi, useUiMotion } from "../provider";
import { Button } from "./button";
import { Icon } from "./icon";

const defaultSlide = ({ children, className }: CarouselSlideProps) => (
  <div className={className}>{children}</div>
);

// Ask for more content once fewer than this many viewport widths remain.
const NEAR_END_VIEWPORTS = 2;
const SIDES = ["left", "right"] as const;

type Side = (typeof SIDES)[number];

function syncScroll(
  el: HTMLDivElement | null,
  onNearEnd: (() => void) | undefined,
  setScroll: Dispatch<SetStateAction<ScrollState>>,
): void {
  if (!el) return;
  const isNearEnd =
    el.clientWidth > 0 &&
    el.scrollLeft + el.clientWidth * NEAR_END_VIEWPORTS >= el.scrollWidth;
  if (isNearEnd) onNearEnd?.();
  const next = readScroll(el);
  setScroll((previous) =>
    previous.left === next.left && previous.right === next.right
      ? previous
      : next,
  );
}

interface CarouselArrowProps {
  arrowClassName?: string;
  classNames: CarouselProps["classNames"] & object;
  onClick: (direction: -1 | 1) => void;
  side: Side;
  visible: boolean;
}

function CarouselArrow({
  arrowClassName,
  classNames,
  onClick,
  side,
  visible,
}: CarouselArrowProps) {
  const { icons, labels, parts } = useUi();
  const isLeft = side === "left";
  const icon = isLeft ? icons.previous : icons.next;
  const label = isLeft ? labels.previous : labels.next;
  const direction = isLeft ? -1 : 1;
  return (
    <Button
      aria-hidden={!visible}
      aria-label={label}
      className={parts.carousel.arrow({
        side,
        visible,
        className: [classNames.arrow, arrowClassName],
      })}
      onClick={() => onClick(direction)}
      tabIndex={visible ? 0 : -1}
    >
      {icon ? (
        <Icon
          className={parts.carousel.icon({ className: classNames.icon })}
          icon={icon}
        />
      ) : null}
    </Button>
  );
}

/**
 * A horizontally scrolling row of slides with arrows, drag scrolling and an end callback.
 */
export function Carousel({
  arrowClassName,
  children,
  className,
  classNames = {},
  frameSelector = FRAME_SELECTOR,
  glide,
  itemClassName,
  label,
  onNearEnd,
  ready = true,
  renderSlide = defaultSlide,
  trackProps,
}: CarouselProps) {
  const { parts } = useUi();
  const motionTokens = useUiMotion();
  const track = useRef<HTMLDivElement>(null);
  const stopGlide = useRef<(() => void) | null>(null);
  const [scroll, setScroll] = useState<ScrollState>({
    left: false,
    right: false,
  });
  const nearEnd = useRef(onNearEnd);
  useDragScroll(track);

  useEffect(() => {
    nearEnd.current = onNearEnd;
  });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const sync = () => syncScroll(el, nearEnd.current, setScroll);
    const clip = () => {
      el.style.clipPath = rackClip(el, frameSelector) ?? "";
    };
    sync();
    clip();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      sync();
      clip();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, frameSelector]);

  const stop = () => {
    stopGlide.current?.();
    stopGlide.current = null;
  };

  const scrollBy = (direction: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    const target = glideTarget(el, direction);
    stop();
    if (glide) {
      stopGlide.current = glide(el, target) ?? null;
      return;
    }
    const motion = motionTokens.glide;
    if (motionTokens.reduced || !motion) {
      el.scrollLeft = target;
      return;
    }
    const controls = animate(el.scrollLeft, target, {
      duration: motion.duration,
      ease: [...motion.ease],
      onUpdate: (left) => {
        el.scrollLeft = left;
      },
    });
    stopGlide.current = () => controls.stop();
  };

  const left = ready && scroll.left;
  const right = ready && scroll.right;
  const slideClass = parts.carousel.slide({
    className: [classNames.slide, itemClassName],
  });

  return (
    <div
      aria-label={label}
      aria-roledescription="carousel"
      className={parts.carousel.root({ className: classNames.root })}
      role="group"
    >
      <div
        {...trackProps}
        className={parts.carousel.track({
          className: [classNames.track, className],
        })}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={stop}
        onScroll={() => syncScroll(track.current, nearEnd.current, setScroll)}
        onTouchStart={stop}
        onWheel={stop}
        ref={track}
      >
        {Children.toArray(children).map((child, index) => {
          const slideKey = (child as { key?: string | null }).key ?? index;
          return (
            <SlideSlot key={slideKey}>
              {renderSlide({
                children: child,
                className: slideClass,
                index,
                slideKey,
              })}
            </SlideSlot>
          );
        })}
      </div>

      {SIDES.map((side) => (
        <CarouselArrow
          arrowClassName={arrowClassName}
          classNames={classNames}
          key={side}
          onClick={scrollBy}
          side={side}
          visible={side === "left" ? left : right}
        />
      ))}
    </div>
  );
}

interface SlideSlotProps {
  children: ReactNode;
}

function SlideSlot({ children }: SlideSlotProps) {
  return children;
}

const EDGE_TOLERANCE = 4;

const DRAG_THRESHOLD = 5;

const SCROLL_STEP = 0.8;

// Within this fraction of the track width from either end, a glide snaps to the end.
const END_SNAP_RATIO = 0.25;

/**
 * Default selector for the element inside a carousel slide that the clip follows.
 */
export const FRAME_SELECTOR = "[data-carousel-frame]";

/**
 * Whether a horizontal track can scroll further left and right.
 */
export function readScroll(track: HTMLElement): ScrollState {
  return {
    left: track.scrollLeft > EDGE_TOLERANCE,
    right:
      track.scrollLeft + track.clientWidth < track.scrollWidth - EDGE_TOLERANCE,
  };
}

/**
 * The scrollLeft a carousel should glide to for one step in a direction, snapping to slide edges.
 */
export function glideTarget(track: HTMLElement, direction: -1 | 1): number {
  const max = track.scrollWidth - track.clientWidth;
  const wanted = track.scrollLeft + track.clientWidth * SCROLL_STEP * direction;
  const edges = Array.from(
    track.children,
    (child) => (child as HTMLElement).offsetLeft - track.offsetLeft,
  ).filter((edge) => edge <= max);
  if (edges.length === 0) return Math.min(max, Math.max(0, wanted));

  let target = edges.reduce((best, edge) =>
    Math.abs(edge - wanted) < Math.abs(best - wanted) ? edge : best,
  );
  const snapDistance = track.clientWidth * END_SNAP_RATIO;
  if (direction === 1) {
    // Never settle on the edge already in view; move to the next one.
    if (target <= track.scrollLeft + EDGE_TOLERANCE) {
      target =
        edges.find((edge) => edge > track.scrollLeft + EDGE_TOLERANCE) ?? max;
    }
    if (max - target < snapDistance) target = max;
  } else {
    if (target >= track.scrollLeft - EDGE_TOLERANCE) {
      target =
        [...edges]
          .reverse()
          .find((edge) => edge < track.scrollLeft - EDGE_TOLERANCE) ?? 0;
    }
    if (target < snapDistance) target = 0;
  }
  return target;
}

/** Distance from the top of `track` to the top of `frame`, through offset parents. */
function offsetTopWithin(frame: HTMLElement, track: HTMLElement): number {
  let offset = 0;
  for (
    let node: HTMLElement | null = frame;
    node && node !== track;
    node = node.offsetParent as HTMLElement | null
  ) {
    offset += node.offsetTop;
  }
  return offset;
}

/** SVG path that cuts the track to the frame's rounded band, so rounded corners clip the whole rack. */
function clipPathFor(
  width: number,
  height: number,
  top: number,
  bottom: number,
  r: number,
): string {
  const arc = (x: number, y: number) => `A${r} ${r} 0 0 1 ${x} ${y}`;
  return `path("${[
    `M0 0H${width}V${top}L${width - r} ${top}`,
    arc(width, top + r),
    `V${bottom - r}`,
    arc(width - r, bottom),
    `L${width} ${bottom}V${height}H0V${bottom}L${r} ${bottom}`,
    arc(0, bottom - r),
    `V${top + r}`,
    arc(r, top),
    `L0 ${top}Z`,
  ].join("")}")`;
}

/**
 * A CSS clip-path that rounds the corners of a carousel frame inside its track, or null when not needed.
 */
export function rackClip(
  track: HTMLElement,
  selector = FRAME_SELECTOR,
): string | null {
  const frame = track.querySelector<HTMLElement>(selector);
  if (!frame) return null;
  const radius = Number.parseFloat(getComputedStyle(frame).borderTopLeftRadius);
  if (!(radius > 0)) return null;
  const width = track.offsetWidth;
  const height = track.offsetHeight;
  const offset = offsetTopWithin(frame, track);
  const top = Math.max(0, offset);
  const bottom = Math.min(height, offset + frame.offsetHeight);
  const r = Math.min(radius, (bottom - top) / 2, width / 2);
  if (!(r > 0) || width === 0) return null;
  return clipPathFor(width, height, top, bottom, r);
}

/**
 * Lets a mouse drag scroll the referenced horizontal track, suppressing the click that ends a drag.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>): void {
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
