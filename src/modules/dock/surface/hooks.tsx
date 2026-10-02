"use client";

import {
  useCallback,
  useEffect,
  createContext,
  isValidElement,
  use,
  useMemo,
  useRef,
  useSyncExternalStore,
  useId,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import {
  useDragControls,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import {
  DockSurfaceShellProps,
  type DockScheduledTaskId,
  type DockScheduler,
  type DockSurfaceActions,
  type SurfaceFlowDefinition,
  type SurfaceFlowDefinitionInput,
  type SurfaceFlowHandle,
  type SurfaceResult,
  type SurfaceStackEntry,
  type ActiveSurfaceStep,
  type DockComponentProps,
  type DockItem,
  type NormalizedSurfaceDefinition,
  type NormalizedSurfaceExtension,
  type OpenSurfaceOptions,
  type RenderableSurfaceEntry,
  type SurfaceBuilderDefinition,
  type SurfaceBuilderFactory,
  type SurfaceDescriptor,
  type SurfaceFlowContextValue,
  type SurfaceFlowSession,
  type SurfaceFlowState,
  type SurfaceInput,
  type SurfaceStep,
  type SurfaceViewModelOptions,
  type DockIconSource,
} from "../types";
import { DOCK_SURFACE_FLOW_STATUS, DOCK_SURFACE_PHASE } from "../constants";
import {
  createSurfaceError,
  createSurfaceFlowDefinition,
  createSurfaceFlowSession,
  updateSurfaceFlowSession,
} from "./definition";
import {
  getRestorableSurfaceFlowSnapshot,
  syncSurfaceFlowUrlState,
  toSurfaceFlowState,
  updateSurfaceStackEntry,
  IS_BROWSER,
  getSurfaceUrlValue,
  releaseSurfaceResources,
  type SurfaceRuntimeRefs,
} from "./machine";
import {
  SurfaceExtensionsContext,
  SurfaceExtensionsStore,
  SurfaceHeaderActionStore,
  useSurfaceId,
} from "./context";
import { normalizeSurfaceExtension } from "../utils";
import { useDockFocusTrap } from "../hooks";
import {
  DOCK_SURFACE_BODY_ENTER_TRANSITION,
  DOCK_SURFACE_BODY_EXIT_TRANSITION,
  DOCK_SURFACE_BODY_STEP_TRANSITION,
  DOCK_SURFACE_DRAG_INTERPOLATION,
  DOCK_SURFACE_DRAG_THRESHOLDS,
  dockSurfaceBodyRole,
} from "../motion";
import { report } from "@/utils";

/* eslint-disable react-hooks/immutability -- the surface shell forwards its element through a caller-supplied ref */

export function useSurfaceFlows({
  closeSurface,
  openSurface,
  refs,
  syncSurfaceStack,
}: {
  closeSurface: DockSurfaceActions["closeSurface"];
  openSurface: DockSurfaceActions["openSurface"];
  refs: SurfaceRuntimeRefs;
  syncSurfaceStack: (
    nextStack: SurfaceStackEntry[],
    nextPhase?: string | null,
  ) => void;
}) {
  const updateSurfaceFlow = useCallback(
    (flowId: string, snapshot: unknown): boolean => {
      const surfaceId = refs.flowIndex.get(flowId);
      if (!surfaceId) return false;
      const record = refs.records.get(surfaceId);
      if (!record?.flow) return false;

      const nextSession = updateSurfaceFlowSession(record.flow, snapshot);
      if (!nextSession) return false;

      const nextSurfaceEntry = {
        ...record.entry,
        flow: toSurfaceFlowState(nextSession),
      };
      record.flow = nextSession;
      record.entry = nextSurfaceEntry;
      syncSurfaceFlowUrlState(nextSurfaceEntry, record.urlState);
      syncSurfaceStack(
        updateSurfaceStackEntry(
          refs.stackRef.current,
          surfaceId,
          () => nextSurfaceEntry,
        ),
      );
      return true;
    },
    [syncSurfaceStack, refs],
  );

  const completeSurfaceFlow = useCallback(
    (flowId: string, data: unknown = null): boolean => {
      const surfaceId = refs.flowIndex.get(flowId);
      if (!surfaceId) return false;
      const record = refs.records.get(surfaceId);
      if (record?.flow)
        record.flow = {
          ...record.flow,
          status: DOCK_SURFACE_FLOW_STATUS.COMPLETED,
        };
      closeSurface({ data, success: true }, surfaceId);
      return true;
    },
    [closeSurface, refs],
  );

  const cancelSurfaceFlow = useCallback(
    (flowId: string, data: unknown = null): boolean => {
      const surfaceId = refs.flowIndex.get(flowId);
      if (!surfaceId) return false;
      const record = refs.records.get(surfaceId);
      if (record?.flow)
        record.flow = {
          ...record.flow,
          status: DOCK_SURFACE_FLOW_STATUS.CANCELLED,
        };
      closeSurface(
        { cancelled: true, data, reason: "flow-cancelled", success: false },
        surfaceId,
      );
      return true;
    },
    [closeSurface, refs],
  );

  const getSurfaceFlow = useCallback(
    (flowId: string): SurfaceFlowHandle | null => {
      const surfaceId = refs.flowIndex.get(flowId);
      const session = surfaceId ? refs.records.get(surfaceId)?.flow : null;
      if (!session) return null;
      return {
        cancel: (data: unknown = null) => cancelSurfaceFlow(flowId, data),
        complete: (data: unknown = null) => completeSurfaceFlow(flowId, data),
        flowId,
        isOpen: session.status === DOCK_SURFACE_FLOW_STATUS.OPEN,
        snapshot: session.snapshot,
        status: session.status,
        update: (snapshot: unknown) => updateSurfaceFlow(flowId, snapshot),
      };
    },
    [cancelSurfaceFlow, completeSurfaceFlow, updateSurfaceFlow, refs],
  );

  const openSurfaceFlow = useCallback(
    (
      input: SurfaceFlowDefinitionInput | SurfaceFlowDefinition,
      flowInput: unknown = null,
      {
        preserveUrl = false,
        snapshot,
      }: { preserveUrl?: boolean; snapshot?: unknown } = {},
    ): Promise<SurfaceResult> => {
      const definition = createSurfaceFlowDefinition(input);
      if (!definition) {
        const error = createSurfaceError(
          "DOCK_SURFACE_FLOW_INVALID_DEFINITION",
          "Dock surface flow definition is invalid",
        );
        report("Dock surface flow definition", error);
        return Promise.resolve({ success: false, error });
      }
      const existingSurfaceId = refs.flowIndex.get(definition.id);
      if (definition.singleton && existingSurfaceId) {
        return (
          refs.records.get(existingSurfaceId)?.promise ??
          Promise.resolve({
            success: false,
            error: createSurfaceError(
              "DOCK_SURFACE_FLOW_ORPHANED",
              "Dock surface flow is orphaned",
            ),
          })
        );
      }

      const flowSession = createSurfaceFlowSession(definition, {
        input: flowInput,
        snapshot,
      });
      try {
        const surfaceInput = definition.createSurface({
          flowId: definition.id,
          input: flowInput,
          snapshot: flowSession?.snapshot,
        });
        return openSurface(surfaceInput, { flowSession, preserveUrl });
      } catch (error) {
        report("Dock surface flow factory", error);
        return Promise.resolve({ success: false, error });
      }
    },
    [openSurface, refs],
  );

  const restoreSurfaceFlow = useCallback(
    (
      input: SurfaceFlowDefinitionInput | SurfaceFlowDefinition,
    ): Promise<SurfaceResult> => {
      const definition = createSurfaceFlowDefinition(input);
      const snapshot = getRestorableSurfaceFlowSnapshot(definition);
      if (!definition || snapshot === undefined) return Promise.resolve(null);
      return openSurfaceFlow(definition, null, { preserveUrl: true, snapshot });
    },
    [openSurfaceFlow],
  );

  return {
    cancelSurfaceFlow,
    completeSurfaceFlow,
    getSurfaceFlow,
    openSurfaceFlow,
    restoreSurfaceFlow,
    updateSurfaceFlow,
  };
}

export function useSurfaceLifecycleEffects({
  clearChoreographyTimers,
  closeAllSurfaces,
  focusRestoreFrameRef,
  refs,
  runtimeScheduler,
}: {
  clearChoreographyTimers: () => void;
  closeAllSurfaces: DockSurfaceActions["closeAllSurfaces"];
  focusRestoreFrameRef: RefObject<DockScheduledTaskId | null>;
  refs: SurfaceRuntimeRefs;
  runtimeScheduler: DockScheduler;
}) {
  useEffect(() => {
    if (!IS_BROWSER) return;
    const handlePopState = () => {
      const activeEntry =
        refs.stackRef.current[refs.stackRef.current.length - 1];
      if (!activeEntry?.syncWithUrl && !activeEntry?.urlKey) return;
      if (
        new URL(window.location.href).searchParams.get("surface") ===
        getSurfaceUrlValue(activeEntry)
      )
        return;
      closeAllSurfaces({
        success: false,
        cancelled: true,
        reason: "browser-back",
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [closeAllSurfaces, refs]);

  useEffect(() => {
    return () => {
      clearChoreographyTimers();
      if (focusRestoreFrameRef.current !== null) {
        runtimeScheduler.cancel(focusRestoreFrameRef.current);
        focusRestoreFrameRef.current = null;
      }

      const result = { cancelled: true, reason: "unmount", success: false };
      refs.stackRef.current.forEach(({ id }) =>
        releaseSurfaceResources({ refs, result, surfaceId: id }),
      );

      refs.stackRef.current = [];
      refs.payloads.clear();
      refs.records.clear();
      refs.flowIndex.clear();
    };
  }, [clearChoreographyTimers, focusRestoreFrameRef, refs, runtimeScheduler]);
}

const SurfaceFlowContext = createContext<SurfaceFlowContextValue | null>(null);

export function SurfaceFlowProvider({
  children,
  value,
}: {
  children?: ReactNode;
  value: SurfaceFlowContextValue;
}) {
  return <SurfaceFlowContext value={value}>{children}</SurfaceFlowContext>;
}

export function useSurfaceFlow(input: SurfaceFlowDefinitionInput) {
  const context = use(SurfaceFlowContext);
  const definition = useMemo(() => createSurfaceFlowDefinition(input), [input]);
  const restoredFlowIdsRef = useRef(new Set<string>());
  const flowId = definition?.id ?? null;

  const activeFlow = useMemo((): SurfaceFlowState | null => {
    if (!flowId) return null;
    return (
      context?.surfaceState?.surfaceStack
        ?.map((s) => s.flow)
        .find((f) => f?.flowId === flowId) ?? null
    );
  }, [context?.surfaceState?.surfaceStack, flowId]);

  useEffect(() => {
    if (
      !definition ||
      !context?.restoreSurfaceFlow ||
      restoredFlowIdsRef.current.has(definition.id)
    )
      return;
    restoredFlowIdsRef.current.add(definition.id);
    void context.restoreSurfaceFlow(definition);
  }, [context, definition]);

  const open = useCallback(
    (flowInput: unknown = null): Promise<SurfaceResult> => {
      if (!definition || !context?.openSurfaceFlow) {
        return Promise.resolve({
          success: false,
          error: createSurfaceError(
            "DOCK_SURFACE_FLOW_UNAVAILABLE",
            "Dock surface flow is unavailable",
          ),
        });
      }
      return context.openSurfaceFlow(definition, flowInput);
    },
    [context, definition],
  );

  return useMemo(
    () => ({
      activeFlow,
      cancel: (result: SurfaceResult = null) =>
        flowId ? context?.cancelSurfaceFlow?.(flowId, result) : undefined,
      complete: (result: SurfaceResult = null) =>
        flowId ? context?.completeSurfaceFlow?.(flowId, result) : undefined,
      flowId,
      isOpen: activeFlow?.status === DOCK_SURFACE_FLOW_STATUS.OPEN,
      open,
      snapshot: activeFlow?.snapshot ?? definition?.initialSnapshot ?? null,
      update: (snapshot: unknown) =>
        flowId ? context?.updateSurfaceFlow?.(flowId, snapshot) : undefined,
    }),
    [activeFlow, context, definition?.initialSnapshot, flowId, open],
  );
}

export const DockSurfaceHeaderRadiusContext = createContext<string | null>(
  null,
);

export function useDockSurfaceHeaderButtonModel({
  children,
  className = "",
  disabled = false,
  onClick,
  ariaLabel,
  icon = null,
}: {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  ariaLabel?: string;
  icon?: DockIconSource;
}) {
  const contextRadius = use(DockSurfaceHeaderRadiusContext);

  return { contextRadius };
}

export function useDockSurfaceControlsModel({
  activeItem = null,
  hasExtensions = false,
  onClose = null,
  onBack = null,
  closeLabel = null,
  backLabel = null,
  className = "",
  surfacePhase: propSurfacePhase,
}: {
  activeItem?: DockItem | null;
  hasExtensions?: boolean;
  onClose?: (() => void) | null;
  onBack?: (() => void) | null;
  closeLabel?: string | null;
  backLabel?: string | null;
  className?: string;
  surfacePhase?: string;
}) {
  const phase = propSurfacePhase ?? activeItem?.surfacePhase;
  const isBodyVisible = phase
    ? phase === DOCK_SURFACE_PHASE.EXPANDING_BODY ||
      phase === DOCK_SURFACE_PHASE.OPEN
    : true;
  const actionStore = use(SurfaceExtensionsContext)?.headerActions ?? null;
  const surfaceId = activeItem?.surfaceId || "global";
  const subscribeAction = useCallback(
    (onStoreChange: () => void) =>
      actionStore ? actionStore.subscribe(onStoreChange) : () => {},
    [actionStore],
  );
  const getActionSnapshot = useCallback(
    () => (actionStore ? actionStore.getAction(surfaceId) : null),
    [actionStore, surfaceId],
  );
  const dynamicAction = useSyncExternalStore(
    subscribeAction,
    getActionSnapshot,
    () => null,
  );

  return { isBodyVisible, dynamicAction };
}

export function SurfaceExtensionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [value] = useState(() => ({
    extensions: new SurfaceExtensionsStore(),
    headerActions: new SurfaceHeaderActionStore(),
  }));

  return (
    <SurfaceExtensionsContext value={value}>
      {children}
    </SurfaceExtensionsContext>
  );
}

export function useDockSurfaceExtension({
  align = "left",
  children,
  className = "",
  id,
  order = 0,
  unstyled = false,
}: {
  align?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
  order?: number;
  unstyled?: boolean;
}) {
  const store = use(SurfaceExtensionsContext)?.extensions ?? null;
  const surfaceId = useSurfaceId();
  const generatedId = useId();
  const effectiveId = id || `dock-surface-ext-${generatedId}`;

  useEffect(() => {
    if (!store) return;
    store.setExtension(surfaceId, {
      align,
      className,
      content: children,
      id: effectiveId,
      order,
      unstyled,
    });
  });

  useEffect(() => {
    return () => {
      if (store) store.removeExtension(surfaceId, effectiveId);
    };
  }, [store, surfaceId, effectiveId]);
}

export function useIsSurfaceExtensionsVisible(
  activeItem: DockItem | null | undefined,
): boolean {
  const store = use(SurfaceExtensionsContext)?.extensions ?? null;
  const surfaceId = activeItem?.surfaceId || "global";
  const isSurface = Boolean(activeItem?.isSurface);
  const phase = activeItem?.surfacePhase;
  const isBodyVisible =
    phase === DOCK_SURFACE_PHASE.EXPANDING_BODY ||
    phase === DOCK_SURFACE_PHASE.OPEN;

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      store ? store.subscribe(onStoreChange) : () => {},
    [store],
  );
  const getSnapshot = useCallback(
    () => (store ? store.getExtensionsForSurface(surfaceId).length : 0),
    [store, surfaceId],
  );

  const dynamicCount = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  const descriptorCount = useMemo(() => {
    const raw = activeItem?.surfaceExtensions || activeItem?.extensions || [];
    return Array.isArray(raw) ? raw.length : 0;
  }, [activeItem?.surfaceExtensions, activeItem?.extensions]);

  return Boolean(
    isSurface && isBodyVisible && (dynamicCount > 0 || descriptorCount > 0),
  );
}

export function useDockSurfaceExtensionsBarModel({
  activeItem,
}: {
  activeItem?: DockItem | null;
}) {
  const store = use(SurfaceExtensionsContext)?.extensions ?? null;
  const surfaceId = activeItem?.surfaceId || "global";
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      store ? store.subscribe(onStoreChange) : () => {},
    [store],
  );
  const getSnapshot = useCallback(
    () => (store ? store.getExtensionsForSurface(surfaceId) : []),
    [store, surfaceId],
  );
  const dynamicExtensions = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => [],
  );
  const descriptorExtensions = useMemo(() => {
    const raw = activeItem?.surfaceExtensions || activeItem?.extensions || [];
    return Array.isArray(raw)
      ? raw
          .map(normalizeSurfaceExtension)
          .filter((ext): ext is NormalizedSurfaceExtension => ext !== null)
      : [];
  }, [activeItem?.surfaceExtensions, activeItem?.extensions]);
  const allExtensions = useMemo(() => {
    const map = new Map<string, NormalizedSurfaceExtension>();
    descriptorExtensions.forEach((ext) => map.set(ext.id, ext));
    dynamicExtensions.forEach((ext) => map.set(ext.id, ext));
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [descriptorExtensions, dynamicExtensions]);

  return { allExtensions };
}

const DRAG_RANGE = [...DOCK_SURFACE_DRAG_INTERPOLATION.DRAG_RANGE];

const OPACITY_RANGE = [...DOCK_SURFACE_DRAG_INTERPOLATION.OPACITY_RANGE];

const SCALE_RANGE = [...DOCK_SURFACE_DRAG_INTERPOLATION.SCALE_RANGE];

export function useDockSurfaceShellModel({
  ref,
  title = "",
  onClose = null,
  onBack = null,
  allowSwipeDismiss = true,
  closeLabel = "Close surface",
  backLabel = "Previous step",
  showControls = false,
  className = "",
  contentClassName = "",
  children,
  onAnimationComplete = null,
  isActive = true,
  surfaceId = null,
  surfacePhase = DOCK_SURFACE_PHASE.OPEN,
  surfaceWidth = null,
}: DockSurfaceShellProps) {
  const surfaceElementRef = useRef<HTMLElement | null>(null);
  const setSurfaceElementRef = useCallback(
    (node: HTMLElement | null) => {
      surfaceElementRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLElement | null }).current = node;
    },
    [ref],
  );
  const isFullyOpen = surfacePhase === DOCK_SURFACE_PHASE.OPEN;
  const titleId =
    surfaceId == null ? undefined : `dock-surface-title-${surfaceId}`;
  const dragY = useMotionValue(0);
  const dragOpacity = useTransform(dragY, DRAG_RANGE, OPACITY_RANGE);
  const dragScale = useTransform(dragY, DRAG_RANGE, SCALE_RANGE);
  useDockFocusTrap({
    containerRef: surfaceElementRef,
    enabled: isActive && isFullyOpen,
    onDismiss: typeof onClose === "function" ? onClose : null,
  });
  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (
      !isActive ||
      !allowSwipeDismiss ||
      typeof onClose !== "function" ||
      !isFullyOpen
    )
      return;
    if (
      info.offset.y > DOCK_SURFACE_DRAG_THRESHOLDS.DISMISS_OFFSET_Y ||
      info.velocity.y > DOCK_SURFACE_DRAG_THRESHOLDS.DISMISS_VELOCITY_Y
    ) {
      onClose();
    }
  };
  const dragControls = useDragControls();
  const canDragDismiss = Boolean(
    isActive &&
    allowSwipeDismiss &&
    typeof onClose === "function" &&
    isFullyOpen,
  );
  const handleSurfacePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!canDragDismiss) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest?.(
          'input, textarea, select, [role="slider"], [data-no-surface-drag], [data-lenis-prevent]',
        )
      ) {
        return;
      }
      dragControls.start(event);
    },
    [canDragDismiss, dragControls],
  );
  const isBodyVisible =
    surfacePhase === DOCK_SURFACE_PHASE.EXPANDING_BODY ||
    surfacePhase === DOCK_SURFACE_PHASE.OPEN;
  const resolvedSurfaceId = surfaceId || "active";
  const bodyVariants = useMemo(
    () => ({
      hidden: dockSurfaceBodyRole.hidden,
      visible: {
        ...dockSurfaceBodyRole.visible,
        transition:
          surfacePhase === DOCK_SURFACE_PHASE.EXPANDING_BODY
            ? DOCK_SURFACE_BODY_ENTER_TRANSITION
            : DOCK_SURFACE_BODY_STEP_TRANSITION,
      },
      exit: {
        ...dockSurfaceBodyRole.exit,
        transition: DOCK_SURFACE_BODY_EXIT_TRANSITION,
      },
    }),
    [surfacePhase],
  );
  const surfaceItemValue = useMemo(
    () => ({ id: resolvedSurfaceId, width: surfaceWidth }),
    [resolvedSurfaceId, surfaceWidth],
  );

  return {
    setSurfaceElementRef,
    titleId,
    dragY,
    dragOpacity,
    dragScale,
    handleDragEnd,
    dragControls,
    canDragDismiss,
    handleSurfacePointerDown,
    isBodyVisible,
    bodyVariants,
    surfaceItemValue,
  };
}
