"use client";

import { useState } from "react";
import { useUi } from "../provider";
import { Image } from "./image";
import type { AvatarProps } from "@/react/ui/types";
import { initialsOf } from "../utils";

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
