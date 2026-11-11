"use client";

import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { animate } from "motion/react";
import type { PartClassNames } from "../define";
import { useUi, useUiMotion } from "../provider";
import { Button } from "../components/button";
import { Icon } from "../components/icon";
import {
  FRAME_SELECTOR,
  glideTarget,
  rackClip,
  readScroll,
  type ScrollState,
} from "./track";
import { useDragScroll } from "./use-drag-scroll";

/** Moves the track to `target`; returns a function that stops the move. */
export type CarouselGlide = (
  track: HTMLElement,
  target: number,
) => (() => void) | void;

export interface CarouselSlideProps {
  children: ReactNode;
  className: string;
  index: number;
  /** The child's own key, or its index. */
  slideKey: string | number;
}

export interface CarouselProps {
  children: ReactNode;
  /** @deprecated Use `classNames.arrow`. */
  arrowClassName?: string;
  className?: string;
  classNames?: PartClassNames<"carousel">;
  /** The slide part whose corners round the rack's ends. */
  frameSelector?: string;
  /** Replaces the default glide (the ui's `glide` motion through `motion`). */
  glide?: CarouselGlide;
  /** @deprecated Use `classNames.slide`. */
  itemClassName?: string;
  label?: string;
  /** Fires a page before the end, to load more. */
  onNearEnd?: () => void;
  /** Arrows stay hidden until the slides are ready (an entrance still playing). */
  ready?: boolean;
  /** Draws each slide; the default is a plain `div`. */
  renderSlide?: (props: CarouselSlideProps) => ReactNode;
}

const defaultSlide = ({ children, className }: CarouselSlideProps) => (
  <div className={className}>{children}</div>
);

/**
 * A horizontal rack of cards. It scrolls by touch, wheel and mouse drag;
 * arrows glide a page at a time; `onNearEnd` fires a page before the end.
 *
 *   <Carousel label="Popular" classNames={{ slide: "w-48" }}>{cards}</Carousel>
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
}: CarouselProps) {
  const { icons, labels, parts } = useUi();
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

  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;
    if (
      el.clientWidth > 0 &&
      el.scrollLeft + el.clientWidth * 2 >= el.scrollWidth
    )
      nearEnd.current?.();
    const next = readScroll(el);
    setScroll((previous) =>
      previous.left === next.left && previous.right === next.right
        ? previous
        : next,
    );
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
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
  }, [sync, children, frameSelector]);

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
    if (motionTokens.reduced) {
      el.scrollLeft = target;
      return;
    }
    const controls = animate(el.scrollLeft, target, {
      duration: motionTokens.glide.duration,
      ease: [...motionTokens.glide.ease],
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
        className={parts.carousel.track({
          className: [classNames.track, className],
        })}
        data-cursor="drag"
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={stop}
        onScroll={sync}
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

      {(["left", "right"] as const).map((side) => {
        const visible = side === "left" ? left : right;
        return (
          <Button
            aria-hidden={!visible}
            aria-label={side === "left" ? labels.previous : labels.next}
            className={parts.carousel.arrow({
              side,
              visible,
              className: [classNames.arrow, arrowClassName],
            })}
            key={side}
            onClick={() => scrollBy(side === "left" ? -1 : 1)}
            tabIndex={visible ? 0 : -1}
          >
            <Icon
              icon={side === "left" ? icons.previous : icons.next}
              size={18}
            />
          </Button>
        );
      })}
    </div>
  );
}

/** Keeps each slide keyed by its child, whatever `renderSlide` returns. */
function SlideSlot({ children }: { children: ReactNode }) {
  return children;
}
