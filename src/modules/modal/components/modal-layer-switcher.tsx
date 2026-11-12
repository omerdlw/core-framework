"use client";

import { Button } from "@/react/ui/components/button";

import { type Theme } from "../lib/theme";
import { getModalLabel } from "../model/identity";
import { type ModalEntry } from "../types";

export function ModalLayerSwitcher({
  currentEntry,
  onSwitchToPrevious,
  previousEntry,
  theme,
}: {
  currentEntry: ModalEntry;
  onSwitchToPrevious: () => void;
  previousEntry: ModalEntry;
  theme: Theme;
}) {
  return (
    <div className={theme.slots.switcher}>
      <Button
        type="button"
        onClick={onSwitchToPrevious}
        className={theme.slots.switcherButton}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M7.5 2.5L4 6l3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {getModalLabel(previousEntry.modalType)}
      </Button>
      <span className={theme.slots.switcherDivider}>/</span>
      <span className={theme.slots.switcherCurrent}>
        {getModalLabel(currentEntry.modalType)}
      </span>
    </div>
  );
}
