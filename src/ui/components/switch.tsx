"use client";

import type { ButtonHTMLAttributes, Ref } from "react";
import type { PartClassNames, PartsProps } from "../define";
import { useUi } from "../provider";
import { splitVariants } from "../split";

export type SwitchVariants = PartsProps<"switch", "track" | "thumb">;

export interface SwitchProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    SwitchVariants {
  checked?: boolean;
  classNames?: PartClassNames<"switch">;
  onCheckedChange?: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
}

export function Switch({
  checked = false,
  className,
  classNames,
  disabled = false,
  onCheckedChange,
  onClick,
  ref,
  type = "button",
  ...props
}: SwitchProps) {
  const { parts } = useUi();
  const [variants, rest] = splitVariants(
    props,
    parts.switch.track,
    parts.switch.thumb,
  );
  const state = checked ? "checked" : "unchecked";

  return (
    <button
      ref={ref}
      type={type}
      role="switch"
      aria-checked={checked}
      data-state={state}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !disabled) onCheckedChange?.(!checked);
      }}
      className={parts.switch.track({
        ...variants,
        className: [classNames?.track, className],
      })}
      {...rest}
    >
      <span
        data-state={state}
        className={parts.switch.thumb({
          ...variants,
          className: classNames?.thumb,
        })}
      />
    </button>
  );
}
