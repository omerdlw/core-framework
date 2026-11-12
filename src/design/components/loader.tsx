"use client";

import { useUi } from "../provider";
import { Icon } from "./icon";
import type { LoaderProps, SpinnerProps } from "../types";

function Dots({ color, size }: { color?: string; size?: number }) {
  const { parts } = useUi();
  return (
    <span
      aria-hidden="true"
      className={parts.loader.dots()}
      style={{
        color,
        ...(size === undefined ? null : { "--loader-size": `${size}px` }),
      }}
    >
      <span className={parts.loader.dot()} />
      <span className={parts.loader.dot()} />
      <span className={parts.loader.dot()} />
    </span>
  );
}

export function Loader({ children, className, color, size }: LoaderProps) {
  const { labels, parts } = useUi();
  const over = Boolean(children);
  return (
    <span
      aria-label={labels.loading}
      className={parts.loader.root({ over, className })}
      role="status"
    >
      {over ? (
        <>
          <span className={parts.loader.label()}>{children}</span>
          <span className={parts.loader.overlay()}>
            <Dots color={color} size={size} />
          </span>
        </>
      ) : (
        <Dots color={color} size={size} />
      )}
    </span>
  );
}

export function Spinner({ className, icon, size }: SpinnerProps) {
  const { icons, labels, parts } = useUi();
  const glyph = icon ?? icons.spinner;
  return (
    <span
      aria-label={labels.loading}
      className={parts.loader.spinner({ className })}
      role="status"
    >
      {glyph ? (
        <Icon className={parts.loader.icon()} icon={glyph} size={size} />
      ) : null}
    </span>
  );
}
