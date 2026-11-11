"use client";

import type { ComponentProps, ReactNode, Ref } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Z_INDEX } from "@/tokens";
import type { PartClassNames } from "../define";
import { useUi } from "../provider";

type DataAttributes = { [name: `data-${string}`]: string | undefined };

export interface TooltipProps {
  children: ReactNode;
  className?: string;
  classNames?: PartClassNames<"tooltip">;
  collisionPadding?: number;
  contentProps?: Omit<
    ComponentProps<typeof TooltipPrimitive.Content>,
    "children" | "className" | "side"
  > &
    DataAttributes;
  defaultOpen?: boolean;
  delayMs?: number;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  position?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  text: ReactNode;
  triggerRef?: Ref<HTMLButtonElement>;
}

export function Tooltip({
  children,
  className,
  classNames,
  collisionPadding = 8,
  contentProps,
  defaultOpen,
  delayMs,
  onOpenChange,
  open,
  position = "top",
  sideOffset = 10,
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
          align="center"
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          {...contentProps}
          className={parts.tooltip.content({
            className: ["pointer-events-none", classNames?.content, className],
          })}
          style={{ zIndex: Z_INDEX.TOOLTIP, ...contentProps?.style }}
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
