"use client";

import { Icon as IconifyIcon } from "@iconify-icon/react";

import type { IconProps } from "@/react/ui/types";

export function Icon({
  className,
  color,
  icon,
  onClick,
  size,
  style,
  ...props
}: IconProps) {
  return (
    <IconifyIcon
      className={className}
      height={size}
      icon={icon}
      onClick={onClick}
      style={
        size === undefined
          ? { color, ...style }
          : { color, height: size, width: size, ...style }
      }
      width={size}
      {...props}
    />
  );
}
