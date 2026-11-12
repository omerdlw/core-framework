"use client";

import { useState } from "react";

import type { AvatarProps } from "@/react/ui/types";

import { useUi } from "../provider";
import { initialsOf } from "../utils";
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
