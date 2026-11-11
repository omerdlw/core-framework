"use client";

import {
  createContext,
  type FocusEvent,
  type ReactNode,
  use,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LayoutGroup, motion } from "motion/react";
import { useUi, useUiMotion } from "../provider";

const INSTANT = { duration: 0 } as const;

export function SlidingHighlight({
  className,
  layoutId,
}: {
  className?: string;
  layoutId: string;
}) {
  const { cn, parts } = useUi();
  const { follow, reduced } = useUiMotion();
  return (
    <motion.span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-0",
        className ?? parts.highlight.fill(),
      )}
      layoutId={layoutId}
      transition={{ layout: reduced ? INSTANT : follow }}
    />
  );
}

export interface PillBox {
  height?: number;
  width: number;
  x: number;
  y?: number;
}

export function useSlidingPill<T extends HTMLElement>(
  selector: string,
  key: unknown,
  { wrapping = false }: { wrapping?: boolean } = {},
) {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<PillBox | null>(null);

  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const measure = () => {
      const chosen = list.querySelector<HTMLElement>(selector);
      if (!chosen) return;
      const next: PillBox = wrapping
        ? {
            height: chosen.offsetHeight,
            width: chosen.offsetWidth,
            x: chosen.offsetLeft,
            y: chosen.offsetTop,
          }
        : { width: chosen.offsetWidth, x: chosen.offsetLeft };
      setBox((prev) =>
        prev &&
        prev.x === next.x &&
        prev.y === next.y &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const child of list.children) observer.observe(child);
    return () => observer.disconnect();
  }, [key, selector, wrapping]);

  return { box, ref };
}

export function SlidingPill({
  box,
  className,
}: {
  box: PillBox;
  className: string;
}) {
  const { cn } = useUi();
  const { follow, reduced } = useUiMotion();
  return (
    <motion.span
      animate={
        box.height === undefined
          ? { width: box.width, x: box.x }
          : { height: box.height, width: box.width, x: box.x, y: box.y }
      }
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute left-0",
        box.height !== undefined && "top-0",
        className,
      )}
      data-pill=""
      initial={false}
      transition={reduced ? INSTANT : follow}
    />
  );
}

interface Tracker {
  active: string | null;
  focus: (key: string | null) => void;
  hover: (key: string | null) => void;
  id: string;
}

const HighlightContext = createContext<Tracker | null>(null);

export function HighlightGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const tracker = useMemo<Tracker>(
    () => ({
      active: hovered ?? focused,
      focus: setFocused,
      hover: setHovered,
      id,
    }),
    [focused, hovered, id],
  );

  return (
    <HighlightContext value={tracker}>
      <LayoutGroup id={id}>
        <div className={className} onPointerLeave={() => setHovered(null)}>
          {children}
        </div>
      </LayoutGroup>
    </HighlightContext>
  );
}

export function useHighlight(key: string, className?: string) {
  const tracker = use(HighlightContext);
  return {
    node:
      tracker?.active === key ? (
        <SlidingHighlight
          className={className}
          layoutId={`highlight-${tracker.id}`}
        />
      ) : null,
    props: {
      onBlur: () => tracker?.focus(null),
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.target.matches(":focus-visible")) tracker?.focus(key);
      },
      onPointerEnter: () => tracker?.hover(key),
    },
  };
}

export function useHighlightReset() {
  const tracker = use(HighlightContext);
  return { onPointerEnter: () => tracker?.hover(null) };
}
