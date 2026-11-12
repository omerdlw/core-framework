"use client";

import React, { type ComponentType, type SyntheticEvent } from "react";

import type { DockItem, DockSlotContent } from "../types";

function resolveActionNode(
  action: DockSlotContent | undefined,
  mediaAction: ComponentType | null,
  showMediaAction: boolean,
  stackClass: string,
) {
  const MediaAction = mediaAction!;

  if (React.isValidElement(action)) {
    return (
      <div className={stackClass}>
        {action}
        {showMediaAction && <MediaAction />}
      </div>
    );
  }
  if (typeof action === "function") {
    const ActionComponent = action as ComponentType;
    return (
      <div className={stackClass}>
        <ActionComponent />
        {showMediaAction && <MediaAction />}
      </div>
    );
  }
  return showMediaAction ? <MediaAction /> : null;
}

export function applyMediaAction(
  item: DockItem | null | undefined,
  hasMedia: boolean,
  toggleMedia: () => void,
  mediaAction: ComponentType | null,
  actionStackClass: string,
): DockItem | null {
  if (!item) return null;
  if (!hasMedia) return item;

  const showMediaAction = Boolean(mediaAction) && item.mediaAction !== false;
  return {
    ...item,
    action: resolveActionNode(
      item.action,
      mediaAction,
      showMediaAction,
      actionStackClass,
    ),
    onClick: (event?: SyntheticEvent) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      toggleMedia();
    },
  };
}
