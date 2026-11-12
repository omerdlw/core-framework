"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useUi } from "../provider";
import { splitVariants } from "../split";
import type { InputProps, TextareaProps } from "../types";

export function Input({
  className,
  ref,
  type = "text",
  ...props
}: InputProps) {
  const { parts } = useUi();
  const [variants, rest] = splitVariants(props, parts.input.field);
  return (
    <input
      ref={ref}
      type={type}
      className={parts.input.field({ ...variants, className })}
      {...(rest as InputHTMLAttributes<HTMLInputElement>)}
    />
  );
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
  const [variants, rest] = splitVariants(
    props,
    parts.input.field,
    parts.input.area,
  );
  return (
    <textarea
      ref={ref}
      className={parts.input.field({
        ...variants,
        className: [parts.input.area(variants), className],
      })}
      style={{ maxHeight, minHeight, ...style }}
      {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
    />
  );
}
