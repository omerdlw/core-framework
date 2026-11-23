import type { DockActionDescriptor, DockItem } from "./card";

/** What the front card needs to draw the compact layout. */
export interface DockCompactProps {
  activeItem: DockItem | null;
  contextCommands: DockActionDescriptor[];
  /** Reports the compact row's own width in px, so the dock can fit it. */
  onWidthChange: (width: number) => void;
  setCompact: (compact: boolean) => void;
}
