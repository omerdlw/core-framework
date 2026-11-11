"use client";

import type { ButtonHTMLAttributes, Ref } from "react";
import type { PartProps } from "../define";
import { useUi } from "../provider";
import { splitVariants } from "../split";
import { Loader } from "./loader";

export type ButtonVariants = PartProps<"button", "root">;

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariants {
  /** Keeps the label's width and lays the loader over it. */
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The button. Give it an `intent` to draw it from the `button.root` recipe;
 * without one it is bare (`button.bare`), for a caller that composes its own
 * surface (a card, a tab).
 *
 *   <Button intent="primary">Save</Button>
 *   <Button intent="ghost" icon shape="pill" size="sm" aria-label="Close">
 *     <Icon icon="…" />
 *   </Button>
 */
export function Button({
  children,
  className,
  disabled = false,
  loading = false,
  ref,
  type = "button",
  ...props
}: ButtonProps) {
  const { parts } = useUi();
  const [variants, rest] = splitVariants(props, parts.button.root);
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
      className={
        variants.intent == null
          ? parts.button.bare({ className })
          : parts.button.root({ ...variants, className })
      }
      {...rest}
    >
      {loading ? (
        <span className={parts.button.busy()}>
          <span className="invisible col-start-1 row-start-1 select-none">
            {children}
          </span>
          <span className="center col-start-1 row-start-1">
            <Loader />
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
