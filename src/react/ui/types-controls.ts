import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from "react";

import type {
  PartClassNames,
  PartProps,
  PartsProps,
} from "@/foundation/recipes/define";

import type { DataAttributes } from "./types";

/**
 * Variant props of the checkbox box.
 */
export type CheckboxVariants = PartProps<"checkbox", "box">;

/**
 * Props of `CheckboxIndicator`.
 */
export interface CheckboxIndicatorProps extends Omit<
  CheckboxVariants,
  "checked"
> {
  checked: boolean;
  className?: string;
  icon?: string;
  pending?: boolean;
}

/**
 * Props of `Checkbox`.
 */
export interface CheckboxProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    Omit<CheckboxIndicatorProps, "className"> {
  children?: ReactNode;
  classNames?: PartClassNames<"checkbox">;
  onCheckedChange?: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Variant props of the input field.
 */
export type InputVariants = PartProps<"input", "field">;

/**
 * Props of `Input`.
 */
export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">, InputVariants {
  ref?: Ref<HTMLInputElement>;
}

/**
 * Props of `Textarea`.
 */
export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, InputVariants {
  maxHeight?: number;
  minHeight?: number;
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * One option of a `SegmentedControl`.
 */
export interface SegmentedItem<K extends string> {
  count?: number;
  icon?: string;
  key: K;
  label: ReactNode;
  disabled?: boolean;
}

/**
 * Variant props of the segmented control.
 */
export type SegmentedControlVariants = Omit<
  PartsProps<"segmented", "root" | "segment" | "pill">,
  "active"
>;

/**
 * Props of `SegmentedControl`.
 */
export interface SegmentedControlProps<
  K extends string,
> extends SegmentedControlVariants {
  ariaLabel?: string;
  className?: string;
  classNames?: PartClassNames<"segmented">;
  items: readonly SegmentedItem<K>[];
  onChange: (key: K) => void;
  value: K;
  iconSize?: number;
}

/**
 * One option of a `Select`.
 */
export interface SelectOption<T extends string = string> {
  description?: ReactNode;
  disabled?: boolean;
  icon?: string;
  label: ReactNode;
  value: T;
}

/**
 * Per-part class names of the select.
 */
export type SelectClassNames = PartClassNames<"select"> & { content?: string };

/**
 * Variant props of the select.
 */
export type SelectVariants = PartsProps<
  "select",
  "trigger" | "menu" | "option"
>;

/**
 * Props of `Select`.
 */
export interface SelectProps<T extends string = string> extends SelectVariants {
  ariaLabel?: string;
  className?: string;
  classNames?: SelectClassNames;
  collisionPadding?: number;
  defaultValue?: T;
  disabled?: boolean;
  empty?: ReactNode;
  floatingProps?: HTMLAttributes<HTMLDivElement> & DataAttributes;
  name?: string;
  offset?: number;
  onChange?: (value: T, option: SelectOption<T>) => void;
  options: readonly SelectOption<T>[];
  placeholder?: ReactNode;
  placement?: "inline" | "popover";
  value?: T;
}

/**
 * The measured position of a select's trigger, used to place its menu.
 */
export interface Anchor {
  edge: number;
  left: number;
  maxHeight: number;
  up: boolean;
  width: number;
}

/**
 * Variant props of the switch.
 */
export type SwitchVariants = PartsProps<"switch", "track" | "thumb">;

/**
 * Props of `Switch`.
 */
export interface SwitchProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    SwitchVariants {
  checked?: boolean;
  classNames?: PartClassNames<"switch">;
  onCheckedChange?: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
}
