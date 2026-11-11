"use client";

import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import type { PartClassNames, PartProps } from "../define";
import { useUi } from "../provider";
import { splitVariants } from "../split";
import { Icon } from "./icon";
import { Loader } from "./loader";

const GLYPH: Readonly<Record<string, number>> = { md: 16, sm: 14 };

export type CheckboxVariants = PartProps<"checkbox", "box">;

export interface CheckboxIndicatorProps
  extends Omit<CheckboxVariants, "checked"> {
  checked: boolean;
  className?: string;
  /** Overrides the ui's `icons.check`. */
  icon?: string;
  /** Plays the loader in place of the check while a change is saving. */
  pending?: boolean;
}

/**
 * The check alone, for a row that is itself the checkbox (it carries
 * `role="checkbox"` or `aria-pressed` and the `group` class).
 */
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
  const size = String(variants.size ?? parts.checkbox.box.def.defaultVariants?.size ?? "md");
  return (
    <span
      aria-hidden="true"
      className={parts.checkbox.box({ ...variants, className })}
    >
      {pending ? (
        <Loader />
      ) : (
        <Icon
          className={parts.checkbox.glyph(variants)}
          icon={icon ?? icons.check}
          size={GLYPH[size] ?? 16}
        />
      )}
    </span>
  );
}

export interface CheckboxProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    Omit<CheckboxIndicatorProps, "className"> {
  children?: ReactNode;
  classNames?: PartClassNames<"checkbox">;
  onCheckedChange?: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
}

/** A labelled checkbox: the check, then `children` as its label. */
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
