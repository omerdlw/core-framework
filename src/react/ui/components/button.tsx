"use client";

import NextLink from "next/link";

import { splitVariants } from "@/foundation/recipes/split";
import type {
  ButtonBaseProps,
  ButtonElementProps,
  ButtonLinkProps,
  ButtonProps,
} from "@/react/ui/types";

import { useUi } from "../provider";
import { Loader } from "./loader";

export function Button({
  children,
  className,
  loading = false,
  ...props
}: ButtonProps) {
  const { parts } = useUi();
  const [variants, element] = splitVariants(
    props as Record<string, unknown>,
    parts.button.root,
  );
  const classes =
    variants.intent == null
      ? parts.button.bare({ className })
      : parts.button.root({ ...variants, className });
  const content = loading ? (
    <span className={parts.button.busy()}>
      <span className={parts.button.busyLabel()}>{children}</span>
      <span className={parts.button.busySpinner()}>
        <Loader />
      </span>
    </span>
  ) : (
    children
  );

  if (element.href != null) {
    const { ref, ...link } = element as Omit<
      ButtonLinkProps,
      keyof ButtonBaseProps
    >;
    return (
      <NextLink
        {...link}
        aria-busy={loading ? true : undefined}
        className={classes}
        ref={ref}
      >
        {content}
      </NextLink>
    );
  }

  const {
    disabled = false,
    ref,
    type = "button",
    ...button
  } = element as Omit<ButtonElementProps, keyof ButtonBaseProps>;
  return (
    <button
      {...button}
      aria-busy={loading ? true : undefined}
      className={classes}
      disabled={disabled || loading}
      ref={ref}
      type={type}
    >
      {content}
    </button>
  );
}
