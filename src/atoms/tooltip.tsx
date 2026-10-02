"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export interface TooltipProps {
  children: ReactNode;
  text: ReactNode;
  className?: string;
  open?: boolean;
  defaultOpen?: boolean;
  delayMs?: number;
  position?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  collisionPadding?: number;
  onOpenChange?: (open: boolean) => void;
}

export function Tooltip({
  children,
  className,
  collisionPadding = 8,
  defaultOpen,
  delayMs,
  onOpenChange,
  open,
  position = "top",
  sideOffset = 6,
  text,
  ...props
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root
      defaultOpen={defaultOpen}
      delayDuration={delayMs}
      onOpenChange={onOpenChange}
      open={open}
    >
      <TooltipPrimitive.Trigger asChild>
        {children}
      </TooltipPrimitive.Trigger>

      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={position}
          align="center"
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={className}
          {...props}
        >
          {text}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

Tooltip.displayName = "Tooltip";
