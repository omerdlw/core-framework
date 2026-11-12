"use client";

import { LayoutGroup, motion } from "motion/react";
import {
  createContext,
  type FocusEvent,
  type ReactNode,
  use,
  useId,
  useState,
} from "react";

import type { PillBox, Tracker } from "@/react/ui/types";

import { useUi, useUiMotion } from "../provider";
import { HIGHLIGHT_STYLE, INSTANT, PILL_BOX_STYLE, PILL_STYLE } from "../utils";

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
