"use client";

import { Icon as IconifyIcon } from "@iconify-icon/react";
import type { ComponentProps, CSSProperties } from "react";

export interface IconProps
  extends Omit<ComponentProps<typeof IconifyIcon>, "icon" | "size"> {
  icon: string | ComponentProps<typeof IconifyIcon>["icon"];
  size?: number | string;
  color?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Icon({
  className = "center",
  color,
  icon,
  onClick,
  size = 20,
  style,
  ...props
}: IconProps) {
  return (
    <IconifyIcon
      className={className}
      height={size}
      icon={icon}
      onClick={onClick}
      style={{ color, ...style }}
      width={size}
      {...props}
    />
  );
}

Icon.displayName = "Icon";
