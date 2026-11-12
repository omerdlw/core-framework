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
import { useUi, useUiMotion } from "../provider";
import { Button } from "./button";
import { Icon } from "./icon";
import type {
  CarouselProps,
  CarouselSlideProps,
  ScrollState,
} from "@/react/ui/types";
import {
  FRAME_SELECTOR,
  glideTarget,
  rackClip,
  readScroll,
  useDragScroll,
} from "../utils";

const defaultSlide = ({ children, className }: CarouselSlideProps) => (
  <div className={className}>{children}</div>
);

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
            {(side === "left" ? icons.previous : icons.next) ? (
              <Icon
                className={parts.carousel.icon({ className: classNames.icon })}
                icon={(side === "left" ? icons.previous : icons.next)!}
              />
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}

function SlideSlot({ children }: { children: ReactNode }) {
  return children;
}
