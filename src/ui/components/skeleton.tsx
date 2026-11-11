"use client";

import type { CSSProperties } from "react";
import type { PartProps } from "../define";
import { useUi } from "../provider";

export type SkeletonVariants = PartProps<"skeleton", "block">;

export interface SkeletonBlockProps extends SkeletonVariants {
  className?: string;
  style?: CSSProperties;
}

export function SkeletonBlock({ className, style, tone }: SkeletonBlockProps) {
  const { parts } = useUi();
  return (
    <div
      aria-hidden="true"
      className={parts.skeleton.block({ tone, className })}
      style={style}
    />
  );
}

export interface SkeletonLinesProps {
  className?: string;
  height?: string;
  phone?: readonly string[];
  widths: readonly string[];
}

export function SkeletonLines({
  className,
  height = "0.62em",
  phone,
  widths,
}: SkeletonLinesProps) {
  const { cn, parts } = useUi();
  if (phone) {
    return (
      <>
        <SkeletonLines
          className={cn(className, "sm:hidden")}
          height={height}
          widths={phone}
        />
        <SkeletonLines
          className={cn(className, "hidden sm:block")}
          height={height}
          widths={widths}
        />
      </>
    );
  }
  return (
    <div aria-hidden="true" className={className}>
      {widths.map((width, index) => (
        <div className={parts.skeleton.line()} key={index}>
          <SkeletonBlock className="rounded-full" style={{ height, width }} />
        </div>
      ))}
    </div>
  );
}
