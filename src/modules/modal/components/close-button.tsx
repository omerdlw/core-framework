"use client";

import { Button } from "@/react/ui/components/button";
import { Icon } from "@/react/ui/components/icon";
import { type Theme } from "../lib/theme";

export function CloseButton({
  close,
  theme,
}: {
  close?: (result?: unknown) => void;
  theme: Theme;
}) {
  if (typeof close !== "function") return null;
  return (
    <Button
      type="button"
      aria-label="Close modal"
      onClick={close}
      className={theme.slots.closeButton}
    >
      <Icon icon="solar:close-bold" size={16} />
    </Button>
  );
}
