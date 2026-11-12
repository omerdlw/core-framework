"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useUi } from "../provider";
import type { TooltipProps } from "@/react/ui/types";

export function Tooltip({
  children,
  className,
  classNames,
  collisionPadding,
  contentProps,
  defaultOpen,
  delayMs,
  onOpenChange,
  open,
  position = "top",
  sideOffset,
  text,
  triggerRef,
}: TooltipProps) {
  const { parts } = useUi();
  return (
    <TooltipPrimitive.Root
      defaultOpen={defaultOpen}
      delayDuration={delayMs}
      onOpenChange={onOpenChange}
      open={open}
    >
      <TooltipPrimitive.Trigger asChild ref={triggerRef}>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={position}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          {...contentProps}
          className={parts.tooltip.content({
            className: [classNames?.content, className],
          })}
          style={{ pointerEvents: "none", ...contentProps?.style }}
        >
          <span
            className={parts.tooltip.label({ className: classNames?.label })}
          >
            {text}
          </span>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;
