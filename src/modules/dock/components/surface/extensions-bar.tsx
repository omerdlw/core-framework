"use client";

import { memo } from "react";
import { cn } from "@/foundation/recipes/cn";
import { useDockSurfaceExtensionsBarModel } from "../../surface/hooks/use-surface-extensions-bar-model";
import type { DockItem, NormalizedSurfaceExtension } from "../../types";
import { useDockTheme } from "../../hooks/use-dock-theme";
import { isValidComponentType } from "../../lib/element-helpers";

function ExtensionPill({
  ext,
  fill = false,
}: {
  ext: NormalizedSurfaceExtension;
  fill?: boolean;
}) {
  const theme = useDockTheme();
  const Component = ext.component;
  const content = Component ? (
    isValidComponentType(Component) ? (
      <Component {...ext.props} />
    ) : null
  ) : (
    ext.content
  );
  if (ext.unstyled)
    return (
      <div
        data-fill={fill}
        className={cn(theme.slots.extensionBare, ext.className)}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    );
  return (
    <div
      data-fill={fill}
      className={cn(theme.slots.extensionPill, ext.className)}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </div>
  );
}

export const DockSurfaceExtensionsBar = memo(function DockSurfaceExtensionsBar({
  activeItem,
}: {
  activeItem?: DockItem | null;
}) {
  const { allExtensions } = useDockSurfaceExtensionsBarModel({ activeItem });
  const theme = useDockTheme();
  if (!allExtensions.length) return null;
  const leftExtensions = allExtensions.filter((e) => e.align === "left");
  const centerExtensions = allExtensions.filter((e) => e.align === "center");
  const rightExtensions = allExtensions.filter((e) => e.align === "right");
  const hasCenter = centerExtensions.length > 0;
  return (
    <div
      className={theme.slots.extensions}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        data-fill={
          !hasCenter &&
          leftExtensions.length === 1 &&
          rightExtensions.length === 0
        }
        className={theme.slots.extensionsLeft}
        style={theme.styles.extensionsLeft}
      >
        {leftExtensions.map((ext) => (
          <ExtensionPill
            key={ext.id}
            ext={ext}
            fill={!hasCenter && leftExtensions.length === 1}
          />
        ))}
      </div>
      {hasCenter && (
        <div
          className={theme.slots.extensionsCenterLayer}
          style={theme.styles.extensionsCenterLayer}
        >
          <div
            data-fill={
              leftExtensions.length === 0 &&
              rightExtensions.length === 0 &&
              centerExtensions.length === 1
            }
            className={theme.slots.extensionsCenter}
          >
            {centerExtensions.map((ext) => (
              <ExtensionPill
                key={ext.id}
                ext={ext}
                fill={
                  leftExtensions.length === 0 &&
                  rightExtensions.length === 0 &&
                  centerExtensions.length === 1
                }
              />
            ))}
          </div>
        </div>
      )}
      <div
        className={theme.slots.extensionsRight}
        style={theme.styles.extensionsRight}
      >
        {rightExtensions.map((ext) => (
          <ExtensionPill key={ext.id} ext={ext} />
        ))}
      </div>
    </div>
  );
});
