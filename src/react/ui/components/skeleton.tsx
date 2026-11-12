"use client";

import type { SkeletonBlockProps, SkeletonLinesProps } from "@/react/ui/types";

import { useUi } from "../provider";

export function SkeletonBlock({
  className,
  style,
  ...props
}: SkeletonBlockProps) {
  const { parts } = useUi();
  return (
    <div
      aria-hidden="true"
      className={parts.skeleton.block({ ...props, className })}
      style={style}
    />
  );
}

export function SkeletonLines({
  className,
  height,
  widths,
}: SkeletonLinesProps) {
  const { parts } = useUi();
  return (
    <div aria-hidden="true" className={parts.skeleton.lines({ className })}>
      {widths.map((width, index) => (
        <div className={parts.skeleton.line()} key={index}>
          <SkeletonBlock
            className={parts.skeleton.bar()}
            style={{ height, width }}
          />
        </div>
      ))}
    </div>
  );
}
