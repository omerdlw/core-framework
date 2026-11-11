"use client";

import { Icon as AtomIcon, type IconProps } from "@/atoms";

export type { IconProps };

/** An Iconify glyph, square, sized in px; centred by default. */
export function Icon({ size = 20, style, ...props }: IconProps) {
  return (
    <AtomIcon
      size={size}
      style={{ height: size, width: size, ...style }}
      {...props}
    />
  );
}
