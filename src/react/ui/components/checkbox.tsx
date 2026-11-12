"use client";

import { useUi } from "../provider";
import { splitVariants } from "@/foundation/recipes/split";
import { Icon } from "./icon";
import { Loader } from "./loader";
import type { CheckboxIndicatorProps, CheckboxProps } from "@/react/ui/types";

export function CheckboxIndicator({
  className,
  icon,
  pending = false,
  ...props
}: CheckboxIndicatorProps) {
  const { icons, parts } = useUi();
  const [variants] = splitVariants(
    props as Record<string, unknown>,
    parts.checkbox.box,
  );
  const glyph = icon ?? icons.check;
  return (
    <span
      aria-hidden="true"
      className={parts.checkbox.box({ ...variants, className })}
    >
      {pending ? (
        <Loader />
      ) : glyph ? (
        <Icon className={parts.checkbox.glyph(variants)} icon={glyph} />
      ) : null}
    </span>
  );
}

export function Checkbox({
  checked,
  children,
  className,
  classNames,
  disabled,
  icon,
  onCheckedChange,
  onClick,
  pending,
  ref,
  type = "button",
  ...props
}: CheckboxProps) {
  const { parts } = useUi();
  const [variants, rest] = splitVariants(props, parts.checkbox.box);
  return (
    <button
      ref={ref}
      type={type}
      role="checkbox"
      aria-checked={checked}
      aria-busy={pending || undefined}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !disabled) onCheckedChange?.(!checked);
      }}
      className={parts.checkbox.root({
        className: [classNames?.root, className],
      })}
      {...rest}
    >
      <CheckboxIndicator
        {...variants}
        checked={checked}
        className={classNames?.box}
        icon={icon}
        pending={pending}
      />
      {children}
    </button>
  );
}
