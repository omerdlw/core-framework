"use client";

import { Icon as AtomIcon, type IconProps } from "@/atoms";

export type { IconProps };

export function Icon({ size = 20, style, ...props }: IconProps) {
  return (
    <AtomIcon
      size={size}
      style={{ height: size, width: size, ...style }}
      {...props}
    />
  );
}
