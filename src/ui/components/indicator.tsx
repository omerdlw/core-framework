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

/*
 * Indicators: a fill that slides after the pointer or the choice, on the ui's
 * `follow` motion. `SlidingHighlight` uses shared layout (one per group, by
 * `layoutId`); `SlidingPill` measures the chosen element and moves to it, for
 * a strip that scrolls.
 */

const INSTANT = { duration: 0 } as const;

/** A shared-layout fill under the active row of a group. */
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
  /** Set when the strip wraps onto rows: the pill then follows y and height too. */
  height?: number;
  width: number;
  x: number;
  y?: number;
}

/**
 * Measures the element matching `selector` inside the list, again when `key`
 * changes. `wrapping` also measures the row (y, height), for a list that can
 * break onto several rows or stack; its pill then needs no `inset-y`.
 */
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

/** The fill drawn under the measured element. */
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

/*
 * A list of rows shares one hover: a single fill slides after the pointer or
 * the keyboard focus, so no row draws a hover background of its own.
 *
 *   <HighlightGroup>
 *     {rows.map((row) => <Row key={row.id} … />)}   // each calls useHighlight(row.id)
 *   </HighlightGroup>
 */

interface Tracker {
  active: string | null;
  focus: (key: string | null) => void;
  hover: (key: string | null) => void;
  id: string;
}

const HighlightContext = createContext<Tracker | null>(null);

/** Holds the shared highlight for the rows inside it. */
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

/** The highlight for one row: render `node` inside it and spread `props` on it. */
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

/** Clears the highlight when the pointer enters a part that is not a row. */
export function useHighlightReset() {
  const tracker = use(HighlightContext);
  return { onPointerEnter: () => tracker?.hover(null) };
}
