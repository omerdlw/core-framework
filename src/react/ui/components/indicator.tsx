"use client";

import { LayoutGroup, motion } from "motion/react";
import {
  createContext,
  type FocusEvent,
  type ReactNode,
  use,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { PillBox, Tracker } from "@/react/ui/types";

import { useUi, useUiMotion } from "../provider";

const INSTANT = { duration: 0 } as const;

const HIGHLIGHT_STYLE = {
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
} as const;

const PILL_STYLE = {
  left: 0,
  pointerEvents: "none",
  position: "absolute",
} as const;

const PILL_BOX_STYLE = { ...PILL_STYLE, top: 0 } as const;

// ---- Highlight ----

interface SlidingHighlightProps {
  className?: string;
  layoutId: string;
}

/**
 * A highlight that slides between items that share its layout id.
 */
export function SlidingHighlight({
  className,
  layoutId,
}: SlidingHighlightProps) {
  const { parts } = useUi();
  const { follow, reduced } = useUiMotion();
  return (
    <motion.span
      aria-hidden="true"
      className={className ?? parts.highlight.fill()}
      layoutId={layoutId}
      style={HIGHLIGHT_STYLE}
      transition={{ layout: reduced ? INSTANT : (follow ?? INSTANT) }}
    />
  );
}

const HighlightContext = createContext<Tracker | null>(null);

interface HighlightGroupProps {
  children: ReactNode;
  className?: string;
}

/**
 * Groups items so one hover or focus highlight slides between them.
 */
export function HighlightGroup({ children, className }: HighlightGroupProps) {
  const id = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const tracker: Tracker = {
    active: hovered ?? focused,
    focus: setFocused,
    hover: setHovered,
    id,
  };

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

/**
 * Returns the highlight node and event props for one item of a `HighlightGroup`.
 */
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

/**
 * Event props that clear the hover highlight when entering a non-item area.
 */
export function useHighlightReset() {
  const tracker = use(HighlightContext);
  return { onPointerEnter: () => tracker?.hover(null) };
}

// ---- Pill ----

interface SlidingPillProps {
  box: PillBox;
  className: string;
}

/**
 * A pill that slides to a measured box.
 */
export function SlidingPill({ box, className }: SlidingPillProps) {
  const { follow, reduced } = useUiMotion();
  const isSingleLine = box.height === undefined;
  return (
    <motion.span
      animate={
        isSingleLine
          ? { width: box.width, x: box.x }
          : { height: box.height, width: box.width, x: box.x, y: box.y }
      }
      aria-hidden="true"
      className={className}
      data-pill=""
      initial={false}
      style={isSingleLine ? PILL_STYLE : PILL_BOX_STYLE}
      transition={reduced ? INSTANT : (follow ?? INSTANT)}
    />
  );
}

function measureBox(chosen: HTMLElement, wrapping: boolean): PillBox {
  return wrapping
    ? {
        height: chosen.offsetHeight,
        width: chosen.offsetWidth,
        x: chosen.offsetLeft,
        y: chosen.offsetTop,
      }
    : { width: chosen.offsetWidth, x: chosen.offsetLeft };
}

function sameBox(a: PillBox, b: PillBox): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}

/**
 * Measures the element matching `selector` inside a list so a pill can slide to it.
 * Remeasures when `key` changes.
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
      const next = measureBox(chosen, wrapping);
      setBox((prev) => (prev && sameBox(prev, next) ? prev : next));
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
