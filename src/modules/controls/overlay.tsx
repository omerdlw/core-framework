"use client";

import { Fragment, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { type ControlsSideProps } from "./types";
import { useControlsModel } from "./hooks";

function ControlsSide({ controls, geometry, side, theme }: ControlsSideProps) {
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
  return (
    <aside
      aria-label={`${side === "left" ? "Left" : "Right"} page controls`}
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
