"use client";

import { useMemo } from "react";
import type {
  GeneralSurfaceHandle,
  SurfaceDescriptor,
  SurfaceHandle,
  SurfaceOpenFn,
  SurfaceResult,
  UseSurfaceInput,
} from "../../types";
import { useDockActions, useDockSelector } from "../../context";

export const EMPTY_SURFACE_STACK: GeneralSurfaceHandle["surfaceStack"] = [];

export function useSurface(
  surfaceDefinition?: UseSurfaceInput | null,
): SurfaceHandle | GeneralSurfaceHandle {
  const { closeAllSurfaces, closeSurface, openSurface } = useDockActions();
  const rawSurfaceStack: GeneralSurfaceHandle["surfaceStack"] = useDockSelector(
    (s) => s.surfaceStack,
  );
  const surfaceStack = rawSurfaceStack || EMPTY_SURFACE_STACK;

  const specificSurface = useMemo((): SurfaceHandle | null => {
    if (!surfaceDefinition) return null;

    const targetComponent =
      typeof surfaceDefinition === "string"
        ? null
        : typeof surfaceDefinition === "function"
          ? surfaceDefinition.component || surfaceDefinition
          : surfaceDefinition.component || null;

    const matchingEntry =
      surfaceStack.find(
        (entry) => targetComponent && entry.component === targetComponent,
      ) ?? null;
    const isThisSurfaceOpen = Boolean(matchingEntry);

    const open: SurfaceOpenFn = (props, overrides) => {
      const entry: SurfaceDescriptor =
        typeof surfaceDefinition === "function"
          ? surfaceDefinition(props, overrides)
          : typeof surfaceDefinition === "string"
            ? { id: surfaceDefinition, props, ...overrides }
            : {
                ...surfaceDefinition,
                props: { ...(surfaceDefinition.props || {}), ...props },
                ...overrides,
              };
      return openSurface(entry);
    };

    const close = (res?: SurfaceResult) =>
      closeSurface(res, matchingEntry?.id ?? null);
    const result = [
      open,
      {
        close,
        closeAll: closeAllSurfaces,
        isOpen: isThisSurfaceOpen,
        surfaceStack,
      },
    ] as SurfaceHandle;
    result.open = open;
    result.close = close;
    result.closeAll = closeAllSurfaces;
    result.isOpen = isThisSurfaceOpen;
    result.surfaceStack = surfaceStack;
    return result;
  }, [
    closeAllSurfaces,
    closeSurface,
    openSurface,
    surfaceDefinition,
    surfaceStack,
  ]);

  const generalSurface = useMemo(
    (): GeneralSurfaceHandle => ({
      closeAllSurfaces,
      closeSurface,
      openSurface,
      surfaceStack,
    }),
    [closeAllSurfaces, closeSurface, openSurface, surfaceStack],
  );

  return surfaceDefinition ? specificSurface! : generalSurface;
}
