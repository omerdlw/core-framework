"use client";

import { Suspense } from "react";

import { Spinner } from "@/react/ui/components/loader";

import { useDockTheme } from "../../hooks/use-dock-theme";
import { stopPropagationOnly } from "../../lib/card";
import { isValidComponentType } from "../../lib/element-helpers";
import type { DockItem, DockItemSurfaceFields } from "../../types";
import { DockSurfaceShell } from "./shell";

function DockSurfaceLoader() {
  const theme = useDockTheme();
  return (
    <div className={theme.slots.surfaceLoader}>
      <Spinner />
    </div>
  );
}

function SurfaceStackItemContent({
  item: propItem,
  link,
  surface,
  isActive,
}: {
  item?: DockItem;
  link?: DockItem;
  surface: DockItemSurfaceFields;
  isActive: boolean;
}) {
  const theme = useDockTheme();
  const item = (propItem ?? link)!;
  const SurfaceComponent = surface.surfaceComponent;
  const surfaceContent = surface.surfaceContent;
  const title = surface.surfaceTitle ?? item.title ?? item.name ?? "";
  const closeLabel =
    surface.surfaceCloseLabel ?? item.closeLabel ?? "Close surface";
  const backLabel =
    surface.surfaceBackLabel ?? item.backLabel ?? "Previous step";

  const onClose =
    surface.dismissible === false
      ? null
      : surface.closeAllSurfaces || surface.closeSurface || item.onClose;
  const onBack =
    surface.onBack ||
    (surface.canGoBack ? surface.popStep || surface.closeSurface : null);

  return (
    <div
      aria-hidden={isActive ? undefined : true}
      hidden={!isActive}
      className={theme.slots.surfaceHost}
      inert={isActive ? undefined : true}
      onClick={stopPropagationOnly}
    >
      <div className={theme.slots.surfaceHostInner}>
        <DockSurfaceShell
          title={title}
          onClose={onClose}
          onBack={onBack}
          allowSwipeDismiss={surface.allowSwipeDismiss !== false}
          closeLabel={closeLabel}
          backLabel={backLabel}
          isActive={isActive}
          onAnimationComplete={surface.onAnimationComplete}
          surfaceId={surface.surfaceId}
          surfacePhase={surface.surfacePhase}
          surfaceWidth={surface.width}
        >
          {isValidComponentType(SurfaceComponent) ? (
            <Suspense fallback={<DockSurfaceLoader />}>
              <SurfaceComponent
                close={surface.closeSurface}
                closeAll={surface.closeAllSurfaces}
                pushStep={surface.pushStep}
                popStep={surface.popStep}
                goToStep={surface.goToStep}
                stepIndex={surface.stepIndex ?? 0}
                totalSteps={surface.totalSteps ?? 1}
                isFirstStep={surface.isFirstStep ?? true}
                isLastStep={surface.isLastStep ?? true}
                surfaceWidth={surface.width}
                {...surface.surfaceProps}
              />
            </Suspense>
          ) : (
            surfaceContent
          )}
        </DockSurfaceShell>
      </div>
    </div>
  );
}

export function SurfaceItemContent({
  item: propItem,
  link,
}: {
  item?: DockItem;
  link?: DockItem;
}) {
  const item = (propItem ?? link)!;
  const surfaceStackEntries = item.surfaceStackEntries?.length
    ? item.surfaceStackEntries
    : [item];
  return (
    <>
      {surfaceStackEntries.map((surface) => (
        <SurfaceStackItemContent
          key={surface.surfaceId ?? "dock-surface"}
          item={item}
          surface={surface}
          isActive={surface.surfaceId === item.surfaceId}
        />
      ))}
    </>
  );
}
