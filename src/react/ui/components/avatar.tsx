"use client";

import { useState } from "react";

import type { AvatarProps } from "@/react/ui/types";

import { useUi } from "../provider";
import { Image } from "./image";

const DEFAULT_ALT = "Avatar";

/**
 * A round image with an initials fallback when the image is missing or fails.
 */
export function Avatar({
  alt,
  children,
  className,
  classNames,
  fallback,
  name,
  ref,
  size,
  src,
  style,
  ...props
}: AvatarProps) {
  const { parts } = useUi();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const dimension = typeof size === "number" ? `${size}px` : size;
  const box = dimension ? { height: dimension, width: dimension } : null;

  return (
    <span
      ref={ref}
      style={{ ...box, ...style }}
      className={parts.avatar.root({
        className: [classNames?.root, className],
      })}
      {...props}
    >
      {src && src !== failedSrc ? (
        <Image
          src={src}
          alt={alt || name || DEFAULT_ALT}
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

/**
 * Up to two uppercase initials for a name, or "?" when there is none.
 */
export function initialsOf(name?: string): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
