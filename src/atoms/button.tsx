"use client";

import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  children?: ReactNode;
  loading?: boolean;
}

export function Button({
  ref,
  children,
  className,
  disabled = false,
  loading = false,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}

Button.displayName = "Button";
