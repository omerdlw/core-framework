"use client";

import { type HTMLAttributes, type ReactNode, type Ref, useState } from "react";
import type { PartClassNames } from "../define";
import { useUi } from "../provider";
import { Image } from "./image";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  alt?: string;
  classNames?: PartClassNames<"avatar">;
  fallback?: ReactNode;
  name?: string;
  ref?: Ref<HTMLSpanElement>;
  size?: number | string;
  src?: string | null;
}

export function initialsOf(name?: string): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({
  alt,
  children,
  className,
  classNames,
  fallback,
  name,
  ref,
  size = 36,
  src,
  style,
  ...props
}: AvatarProps) {
  const { parts } = useUi();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const dimension = typeof size === "number" ? `${size}px` : size;

  return (
    <span
      ref={ref}
      style={{ height: dimension, width: dimension, ...style }}
      className={parts.avatar.root({
        className: [classNames?.root, className],
      })}
      {...props}
    >
      {src && src !== failedSrc ? (
        <Image
          src={src}
          alt={alt || name || "Avatar"}
          onError={() => setFailedSrc(src)}
          className={parts.avatar.image({ className: classNames?.image })}
        />
      ) : (
        <span
          className={parts.avatar.initials({ className: classNames?.initials })}
        >
          {fallback ?? children ?? initialsOf(name || alt)}
        </span>
      )}
    </span>
  );
}
