"use client";

import { type ComponentType, isValidElement, type ReactNode } from "react";

import type { DockActionSlot } from "../../lib/card";
import { useSurfaceAction } from "../../surface/context";
import { useDockSurfaceExtension } from "../../surface/hooks/use-surface-extensions";
import { DockMediaControls } from "../media-controls";

/** Declares the action a surface contributes to its dock card. */
export function DockSurfaceAction({ children }: { children: ReactNode }) {
  useSurfaceAction(children);
  return null;
}

/** Marks content as an extension shown in the surface's extensions bar. */
export function DockSurfaceExtension(props: {
  align?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
  order?: number;
  unstyled?: boolean;
}) {
  useDockSurfaceExtension(props);
  return null;
}

export function renderActionSlot(slot: DockActionSlot): ReactNode {
  if (!slot) return null;
  if (slot.kind === "media") return <DockMediaControls />;
  const { action } = slot;
  if (isValidElement(action)) return action;
  const ActionComponent = action as ComponentType;
  return <ActionComponent />;
}
