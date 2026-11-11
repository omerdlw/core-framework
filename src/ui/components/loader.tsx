"use client";

import type { CSSProperties, ReactNode } from "react";
import type { PartClassNames } from "../define";
import { useUi } from "../provider";
import { Icon } from "./icon";

export interface LoaderProps {
  /** Content whose size the loader keeps while it plays over it. */
  children?: ReactNode;
  className?: string;
  color?: string;
  /** Dot height in px. */
  size?: number;
}

const LAYER = "col-start-1 row-start-1";

function Dots({ color, size }: { color?: string; size: number }) {
  return (
    <span
      aria-hidden="true"
      className="ui-dots"
      style={{ "--loader-size": `${size}px`, color } as CSSProperties}
    >
      <span className="ui-dot" />
      <span className="ui-dot" />
      <span className="ui-dot" />
    </span>
  );
}

/** Three bouncing dots, inline at 1em, or laid over `children`. */
export function Loader({ children, className, color, size = 14 }: LoaderProps) {
  const { cn, labels, parts } = useUi();
  const over = Boolean(children);
  return (
    <span
      aria-label={labels.loading}
      className={parts.loader.root({ over, className })}
      role="status"
    >
      {over ? (
        <>
          <span className={cn("invisible select-none", LAYER)}>{children}</span>
          <span className={cn("center", LAYER)}>
            <Dots color={color} size={size} />
          </span>
        </>
      ) : (
        <Dots color={color} size={size} />
      )}
    </span>
  );
}

export interface SpinnerProps {
  className?: string;
  /** Overrides the ui's `icons.spinner`. */
  icon?: string;
  size?: number;
}

/** A spinning glyph, for a loader that sits beside text. */
export function Spinner({ className, icon, size = 15 }: SpinnerProps) {
  const { icons, labels, parts } = useUi();
  return (
    <span
      aria-label={labels.loading}
      className={parts.loader.spinner({ className })}
      role="status"
    >
      <Icon icon={icon ?? icons.spinner} size={size} />
    </span>
  );
}

export type LoaderClassNames = PartClassNames<"loader">;
