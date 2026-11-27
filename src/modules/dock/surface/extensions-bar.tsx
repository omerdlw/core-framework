"use client";

import { use, useSyncExternalStore } from "react";

import { cn } from "@/foundation/recipes/cn";

import { useDockTheme } from "../theme";
import type { DockItem, NormalizedSurfaceExtension } from "../types";
import { isValidComponentType } from "../utils";
import { SurfaceExtensionsContext } from "./context";
import { normalizeSurfaceExtension } from "./helpers";

function renderExtensionContent(ext: NormalizedSurfaceExtension) {
  const Component = ext.component;
  if (!Component) return ext.content;
  return isValidComponentType(Component) ? <Component {...ext.props} /> : null;
}

function ExtensionPill({
  ext,
  fill = false,
}: {
  ext: NormalizedSurfaceExtension;
  fill?: boolean;
}) {
  const theme = useDockTheme();
  const content = renderExtensionContent(ext);
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

export function DockSurfaceExtensionsBar({
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
}

// Stable subscribe for when no store is mounted.
const NOOP_SUBSCRIBE = () => () => {};

function useDockSurfaceExtensionsBarModel({
  activeItem,
}: {
  activeItem?: DockItem | null;
}) {
  const store = use(SurfaceExtensionsContext)?.extensions ?? null;
  const surfaceId = activeItem?.surfaceId || "active";
  // store.subscribe is a stable class-field arrow.
  const subscribe = store?.subscribe ?? NOOP_SUBSCRIBE;
  const getSnapshot = () =>
    store ? store.getExtensionsForSurface(surfaceId) : [];
  const dynamicExtensions = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => [],
  );
  const raw = activeItem?.surfaceExtensions || activeItem?.extensions || [];
  const descriptorExtensions = Array.isArray(raw)
    ? raw
        .map(normalizeSurfaceExtension)
        .filter((ext): ext is NormalizedSurfaceExtension => ext !== null)
    : [];
  const map = new Map<string, NormalizedSurfaceExtension>();
  descriptorExtensions.forEach((ext) => map.set(ext.id, ext));
  dynamicExtensions.forEach((ext) => map.set(ext.id, ext));
  const allExtensions = Array.from(map.values()).sort(
    (a, b) => a.order - b.order,
  );

  return { allExtensions };
}
