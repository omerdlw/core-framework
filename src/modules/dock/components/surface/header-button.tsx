"use client";

import type { ReactNode } from "react";

import { cn } from "@/foundation/recipes/cn";
import { Button } from "@/react/ui/components/button";
import { Icon } from "@/react/ui/components/icon";

import { useDockTheme } from "../../hooks/use-dock-theme";
import { useDockSurfaceHeaderButtonModel } from "../../surface/hooks/use-surface-header-button-model";
import type { DockIconSource, DockTheme } from "../../types";

const CONTROL_ICON_SIZE = 16;

const ROUNDED_CLASS_PATTERN = /\brounded(?:-[a-zA-Z0-9_-]+)?\b/g;

export function getControlRadiusClass(
  slots: DockTheme["slots"],
  key: string,
  activeKeys: string[],
): string {
  if (activeKeys.length <= 1) return slots.controlRadiusSingle;
  const index = activeKeys.indexOf(key);
  if (index === 0) return slots.controlRadiusFirst;
  if (index === activeKeys.length - 1) return slots.controlRadiusLast;
  return slots.controlRadiusMiddle;
}

export function applyControlRadius(
  className: unknown,
  radiusClass: string,
): string {
  if (typeof className !== "string" || !className) return radiusClass;
  const stripped = className
    .replace(ROUNDED_CLASS_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
  return [stripped, radiusClass].filter(Boolean).join(" ");
}

/** Button styled for the surface header controls, matching their shared corner radius. */
export function DockSurfaceHeaderButton({
  children,
  className = "",
  disabled = false,
  onClick,
  ariaLabel,
  icon = null,
}: {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  ariaLabel?: string;
  icon?: DockIconSource;
}) {
  const { contextRadius } = useDockSurfaceHeaderButtonModel({
    children,
    className,
    disabled,
    onClick,
    ariaLabel,
    icon,
  });
  const theme = useDockTheme();
  const radiusClass = contextRadius ?? theme.slots.controlRadiusSingle;
  const isText = Boolean(children);
  return (
    <Button
      type="button"
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={disabled}
      aria-label={
        ariaLabel || (typeof children === "string" ? children : undefined)
      }
      data-text={isText}
      className={cn(theme.slots.controlHeaderButton, radiusClass, className)}
      style={theme.styles.controlHeaderButton}
    >
      {icon &&
        (typeof icon === "string" ? (
          <Icon icon={icon} size={CONTROL_ICON_SIZE} />
        ) : (
          icon
        ))}
      {children}
    </Button>
  );
}
