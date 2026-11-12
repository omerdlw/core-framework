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

import type {
  CarouselProps,
  CarouselSlideProps,
  ScrollState,
} from "@/react/ui/types";

import { useUi, useUiMotion } from "../provider";
import {
  FRAME_SELECTOR,
  glideTarget,
  rackClip,
  readScroll,
  useDragScroll,
} from "../utils";
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
