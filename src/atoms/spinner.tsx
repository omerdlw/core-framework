"use client";

import { Icon } from "./icon";

export interface SpinnerProps {
  className?: string;
  size?: number;
}

export function Spinner({ className = "", size = 15 }: SpinnerProps) {
  return (
    <div
      className={className}
      aria-label="Loading"
      role="status"
    >
      <Icon icon="mingcute:loading-3-fill" size={size} />
    </div>
  );
}

Spinner.displayName = "Spinner";
