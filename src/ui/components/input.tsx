"use client";

import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from "react";
import type { PartProps } from "../define";
import { useUi } from "../provider";
import { splitVariants } from "../split";

export type InputVariants = PartProps<"input", "field">;

export interface InputProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    Omit<InputVariants, "size"> {
  ref?: Ref<HTMLInputElement>;
  size?: Exclude<InputVariants["size"], "area">;
}

export function Input({
  className,
  ref,
  size = "md",
  type = "text",
  ...props
}: InputProps) {
  const { parts } = useUi();
  const [variants, rest] = splitVariants(props, parts.input.field);
  return (
    <input
      ref={ref}
      type={type}
      className={parts.input.field({ size, ...variants, className })}
      {...(rest as InputHTMLAttributes<HTMLInputElement>)}
    />
  );
}

export interface TextareaProps
  extends
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    Omit<InputVariants, "size"> {
  maxHeight?: number;
  minHeight?: number;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  className,
  maxHeight,
  minHeight,
  ref,
  style,
  ...props
}: TextareaProps) {
  const { parts } = useUi();
  const [variants, rest] = splitVariants(props, parts.input.field);
  return (
    <textarea
      ref={ref}
      className={parts.input.field({ ...variants, size: "area", className })}
      style={{ maxHeight, minHeight, ...style }}
      {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
    />
  );
}
