"use client";

import { type ComponentType, isValidElement, type ReactNode } from "react";

import type { DockActionSlot } from "../../lib/card";
import { useSurfaceAction } from "../../surface/context";
import { useDockSurfaceExtension } from "../../surface/hooks/use-surface-extensions";
import { DockMediaControls } from "../media-controls";

export function DockSurfaceAction({ children }: { children: ReactNode }) {
  useSurfaceAction(children);
  return null;
}

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
