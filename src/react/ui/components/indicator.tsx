"use client";

import {
  createContext,
  type FocusEvent,
  type ReactNode,
  use,
  useId,
  useMemo,
  useState,
} from "react";
import { LayoutGroup, motion } from "motion/react";
import { useUi, useUiMotion } from "../provider";
import type { PillBox, Tracker } from "@/react/ui/types";
import { HIGHLIGHT_STYLE, INSTANT, PILL_BOX_STYLE, PILL_STYLE } from "../utils";

export function SlidingHighlight({
  className,
  layoutId,
}: {
  className?: string;
  layoutId: string;
}) {
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

export function SlidingPill({
  box,
  className,
}: {
  box: PillBox;
  className: string;
}) {
  const { follow, reduced } = useUiMotion();
  return (
    <motion.span
      animate={
        box.height === undefined
          ? { width: box.width, x: box.x }
          : { height: box.height, width: box.width, x: box.x, y: box.y }
      }
      aria-hidden="true"
      className={className}
      data-pill=""
      initial={false}
      style={box.height === undefined ? PILL_STYLE : PILL_BOX_STYLE}
      transition={reduced ? INSTANT : (follow ?? INSTANT)}
    />
  );
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
