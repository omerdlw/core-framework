"use client";

import { usePathname } from "next/navigation";
import {
  type CSSProperties,
  Fragment,
  useMemo,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { useRegistryEntries } from "@/core/kernel";
import { useTheme } from "@/react/theme";

import { controlsTheme } from "./constants";
import { resolveControlsPairs } from "./entries";
import { useControlsLayout } from "./hooks";
import { type ControlEntry, type ControlsSideProps } from "./types";

const emptySubscribe = () => () => {};

/**
 * Portal target, layout, resolved controls and theme for Controls.
 */
export function useControlsModel() {
  const portalTarget = useSyncExternalStore(
    emptySubscribe,
    () => (typeof document !== "undefined" ? document.body : null),
    () => null,
  );
  const layout = useControlsLayout();
  const pathname = usePathname();
  const entries = useRegistryEntries<"controls", ControlEntry>("controls");
  const { left, right } = useMemo(
    () => resolveControlsPairs(entries, pathname),
    [entries, pathname],
  );

  const theme = useTheme(controlsTheme);

  return { portalTarget, layout, left, right, theme };
}

/**
 * One rail of controls beside the dock.
 */
export function ControlsSide({
  controls,
  geometry,
  side,
  theme,
}: ControlsSideProps) {
  if (controls.length === 0 || !geometry.height || !geometry.maxWidth) {
    return null;
  }
  const positionStyle: CSSProperties =
    side === "left"
      ? {
          bottom: geometry.bottom,
          maxWidth: geometry.maxWidth,
          right: geometry.right,
        }
      : {
          bottom: geometry.bottom,
          left: geometry.left,
          maxWidth: geometry.maxWidth,
        };
  const sideLabel = side === "left" ? "Left" : "Right";
  return (
    <aside
      aria-label={`${sideLabel} page controls`}
      className={theme.slots.rail}
      style={{ ...theme.styles.rail, ...positionStyle }}
    >
      <div
        data-side={side}
        className={theme.slots.stack}
        style={
          {
            ...theme.styles.stack,
            "--controls-height": `${geometry.height}px`,
          } as CSSProperties
        }
      >
        {controls.map(({ content, id }, index) => (
          <Fragment key={id || index}>{content}</Fragment>
        ))}
      </div>
    </aside>
  );
}

/**
 * Overlay that renders the page's controls in a portal on both sides of the
 * dock.
 */
export function Controls() {
  const { portalTarget, layout, left, right, theme } = useControlsModel();
  if (!portalTarget || !layout || layout.isHidden || left.length === 0) {
    return null;
  }
  return createPortal(
    <>
      <ControlsSide
        controls={left}
        geometry={{
          ...layout.left,
          bottom: layout.bottom,
          height: layout.height,
        }}
        side="left"
        theme={theme}
      />
      <ControlsSide
        controls={right}
        geometry={{
          ...layout.right,
          bottom: layout.bottom,
          height: layout.height,
        }}
        side="right"
        theme={theme}
      />
    </>,
    portalTarget,
  );
}
