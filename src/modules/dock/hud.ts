"use client";

import {
  useEffect,
  useRef,
  isValidElement,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  shallowEqual as areShallowCollectionsEqual,
  isObject,
  toArray,
} from "@/utils";
import {
  type DockOperation,
  type DockHudDescriptor,
  type DefineHudOptions,
  type DockComponentProps,
  type DockHudDefinition,
  type DockHudOverrides,
  type DockHudTrigger,
  type UseHudReturn,
} from "./types";
import {
  DOCK_HUD_PRIORITY,
  DOCK_HUD_RENDER_MODE,
  DOCK_OPERATION_STATUS,
} from "./constants";
import {
  isHudDescriptor,
  resolveComponentType,
  resolveRenderableContent,
} from "./utils";
import { useDockActions } from "./context";

export type DockHudEntries = Record<string, DockHudDescriptor>;

function normalizePriority(value: unknown): number {
  const priority = Number(value);
  return Number.isFinite(priority) ? priority : DOCK_HUD_PRIORITY.DEFAULT;
}

function normalizeAutoDismiss(value: unknown): number | null {
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

export function createHudDefinition(
  input: unknown,
  config: Partial<DockHudDescriptor> = {},
): DockHudDescriptor | null {
  if (input == null || input === false) return null;
  const descriptor = isHudDescriptor(input) ? input : null;
  const component = resolveComponentType(descriptor?.component, input);
  const content = resolveRenderableContent(
    descriptor?.content,
    descriptor?.node,
    descriptor?.element,
  );
  const directContent =
    content ??
    (isValidElement(input) ||
    typeof input === "string" ||
    typeof input === "number"
      ? (input as ReactNode)
      : null);
  if (!component && directContent == null) return null;
  const id =
    descriptor?.id ??
    config?.id ??
    (component
      ? component.displayName || component.name || "component-hud"
      : "hud");
  return {
    autoDismissMs: normalizeAutoDismiss(
      descriptor?.autoDismissMs ?? config?.autoDismissMs,
    ),
    component,
    content: component ? null : directContent,
    dismissOnEscape:
      descriptor?.dismissOnEscape ?? config?.dismissOnEscape ?? true,
    dismissOnNavigate:
      descriptor?.dismissOnNavigate ?? config?.dismissOnNavigate ?? true,
    id: String(id),
    isActive: Boolean(descriptor?.isActive ?? config?.isActive ?? true),
    onDismiss:
      typeof descriptor?.onDismiss === "function"
        ? descriptor.onDismiss
        : typeof descriptor?.onCancel === "function"
          ? descriptor.onCancel
          : typeof config?.onDismiss === "function"
            ? config.onDismiss
            : typeof config?.onCancel === "function"
              ? config.onCancel
              : null,
    priority: normalizePriority(descriptor?.priority ?? config?.priority),
    props: component && isObject(descriptor?.props) ? descriptor.props : {},
    renderMode: component
      ? DOCK_HUD_RENDER_MODE.COMPONENT
      : DOCK_HUD_RENDER_MODE.NODE,
  };
}

function arePropsEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!isObject(left) || !isObject(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => {
    if (!Object.hasOwn(right, key)) return false;
    if (Object.is(left[key], right[key])) return true;
    if (typeof left[key] === "function" && typeof right[key] === "function") {
      return true;
    }
    return (
      isObject(left[key]) &&
      isObject(right[key]) &&
      areShallowCollectionsEqual(left[key], right[key])
    );
  });
}

export function areHudDefinitionsEqual(
  current: DockHudDescriptor | null | undefined,
  next: DockHudDescriptor | null | undefined,
): boolean {
  if (Object.is(current, next)) return true;
  if (
    !current ||
    !next ||
    Object.keys(current).length !== Object.keys(next).length
  ) {
    return false;
  }
  const currentFields = current as unknown as Record<string, unknown>;
  const nextFields = next as unknown as Record<string, unknown>;
  return Object.keys(nextFields).every((key) => {
    if (Object.is(currentFields[key], nextFields[key])) return true;
    if (key === "props") {
      return arePropsEqual(currentFields[key], nextFields[key]);
    }
    return (
      typeof currentFields[key] === "function" &&
      typeof nextFields[key] === "function"
    );
  });
}

export function upsertHudEntry(
  entries: DockHudEntries,
  definition: DockHudDescriptor | null,
): DockHudEntries {
  if (
    !definition ||
    areHudDefinitionsEqual(entries[definition?.id], definition)
  ) {
    return entries;
  }
  return {
    ...entries,
    [definition.id]: definition,
  };
}

export function removeHudEntries(
  entries: DockHudEntries,
  id: string | null = null,
): DockHudEntries {
  if (!id) return Object.keys(entries).length === 0 ? entries : {};
  if (!entries[id]) return entries;
  const next = {
    ...entries,
  };
  delete next[id];
  return next;
}

function resolveActiveHud(
  entries: (DockHudDescriptor | null)[],
): DockHudDescriptor | null {
  return toArray(entries).reduce<DockHudDescriptor | null>((active, hud) => {
    if (!hud?.isActive) return active;
    return !active ||
      normalizePriority(hud.priority) > normalizePriority(active.priority)
      ? hud
      : active;
  }, null);
}

export function createSelectionModeState(
  config: (Partial<DockHudDescriptor> & { id?: string }) | null | undefined,
): DockHudDescriptor | null {
  return config
    ? createHudDefinition(config, {
        id: config.id || "selection-mode",
        priority: DOCK_HUD_PRIORITY.SELECTION,
      })
    : null;
}

export function areSelectionModeStatesEqual(
  current: DockHudDescriptor | null,
  next: DockHudDescriptor | null,
): boolean {
  return areHudDefinitionsEqual(current, next);
}

export function getActiveDockHud(
  entries: DockHudEntries,
  selectionMode: DockHudDescriptor | null,
): DockHudDescriptor | null {
  return resolveActiveHud([...Object.values(entries), selectionMode]);
}

export function createDockOperationHud(
  operation: DockOperation | null | undefined,
  {
    onCancel = null,
    pendingCount = 1,
  }: { onCancel?: ((id: string) => void) | null; pendingCount?: number } = {},
) {
  if (
    !operation?.id ||
    operation.status !== DOCK_OPERATION_STATUS.PENDING ||
    operation.hud == null
  ) {
    return null;
  }
  const hudInput = isHudDescriptor(operation.hud)
    ? {
        ...operation.hud,
        props: {
          ...(isObject(operation.hud.props) ? operation.hud.props : {}),
          operation,
          pendingCount,
        },
      }
    : typeof operation.hud === "function"
      ? {
          component: operation.hud,
          props: {
            operation,
            pendingCount,
          },
        }
      : {
          content: operation.hud,
        };
  return createHudDefinition({
    ...hudInput,
    dismissOnEscape: false,
    dismissOnNavigate: false,
    id: "dock-operation:" + operation.id,
    isActive: true,
    onDismiss:
      operation.cancellable !== false && typeof onCancel === "function"
        ? () => onCancel(operation.id)
        : null,
    priority: DOCK_HUD_PRIORITY.TASK_PROGRESS + Number(operation.priority || 0),
  });
}

export function useDockHudRegistry() {
  const [selectionModeState, setSelectionModeState] =
    useState<DockHudDescriptor | null>(null);
  const [hudEntries, setHudEntries] = useState<DockHudEntries>({});

  const setHud = useCallback((descriptor: DockHudDescriptor) => {
    const definition = createHudDefinition(descriptor);
    if (!definition) return;
    setHudEntries((prev) => upsertHudEntry(prev, definition));
  }, []);

  const clearHud = useCallback((targetId?: string) => {
    setHudEntries((prev) => removeHudEntries(prev, targetId));
  }, []);

  const setSelectionMode = useCallback(
    (config: Parameters<typeof createSelectionModeState>[0]) => {
      setSelectionModeState((curr) => {
        const nextSelection = createSelectionModeState(config);
        return areSelectionModeStatesEqual(curr, nextSelection)
          ? curr
          : nextSelection;
      });
    },
    [],
  );

  const clearSelectionMode = useCallback(() => setSelectionModeState(null), []);

  const clearTransientHud = useCallback(() => {
    setSelectionModeState(null);
    setHudEntries({});
  }, []);

  const registeredHud = useMemo(
    () => getActiveDockHud(hudEntries, selectionModeState),
    [hudEntries, selectionModeState],
  );

  const actions = useMemo(
    () => ({ clearHud, clearSelectionMode, setHud, setSelectionMode }),
    [clearHud, clearSelectionMode, setHud, setSelectionMode],
  );

  return {
    actions,
    clearTransientHud,
    hudEntries,
    registeredHud,
    selectionModeState,
  };
}

export function useDockHud(descriptor: DockHudDescriptor) {
  const { setHud, clearHud } = useDockActions();
  return useDockHudLifecycle({ clearHud, descriptor, setHud });
}

export function defineHud(
  definition: DefineHudOptions = {},
): DockHudDefinition {
  const {
    autoDismissMs = null,
    component = null,
    defaultProps = {},
    dismissOnEscape = true,
    dismissOnNavigate = true,
    id = "hud",
    priority = DOCK_HUD_PRIORITY.DEFAULT,
    ...extraConfig
  } = definition;

  const createDescriptor = (
    props: DockComponentProps = {},
    overrides: DockHudOverrides = {},
  ): DockHudDescriptor => {
    const mergedProps = { ...defaultProps, ...props };
    return {
      id: overrides.id ?? id,
      component,
      props: mergedProps,
      priority: overrides.priority ?? priority,
      autoDismissMs: overrides.autoDismissMs ?? autoDismissMs,
      dismissOnEscape: overrides.dismissOnEscape ?? dismissOnEscape,
      dismissOnNavigate: overrides.dismissOnNavigate ?? dismissOnNavigate,
      ...extraConfig,
      ...overrides,
    };
  };

  return Object.freeze({
    config: {
      autoDismissMs,
      component,
      defaultProps,
      dismissOnEscape,
      dismissOnNavigate,
      id,
      priority,
      ...extraConfig,
    },
    create: createDescriptor,
    hide: (clearHudFn: (id?: string) => void, targetId?: string) => {
      if (typeof clearHudFn === "function") {
        clearHudFn(targetId || id);
      }
    },
    id,
    show: (
      setHudFn: (descriptor: DockHudDescriptor) => void,
      props: DockComponentProps = {},
      overrides: DockHudOverrides = {},
    ) => {
      const descriptor = createDescriptor(props, overrides);
      if (typeof setHudFn === "function") {
        setHudFn(descriptor);
      }
      return {
        dismiss: (clearHudFn: (id?: string) => void) => {
          if (typeof clearHudFn === "function") {
            clearHudFn(descriptor.id);
          }
        },
        id: descriptor.id,
        update: (nextProps: DockComponentProps = {}) => {
          if (typeof setHudFn === "function") {
            setHudFn(createDescriptor({ ...props, ...nextProps }, overrides));
          }
        },
      };
    },
    use: function useDefinedHud(
      props: DockComponentProps = {},
      overrides: DockHudOverrides = {},
    ) {
      const descriptor = createDescriptor(props, overrides);
      useDockHud(descriptor);
    },
    useTrigger: function useTriggerHud(this: DockHudDefinition) {
      return useHud(this) as DockHudTrigger;
    },
  });
}

export function useHud(hudDefinition: DockHudDefinition | null = null) {
  const { clearHud, setHud } = useDockActions();

  return useMemo((): UseHudReturn => {
    if (!hudDefinition) {
      return { clearHud, setHud };
    }

    const show = (
      props: DockComponentProps = {},
      overrides: DockHudOverrides = {},
    ) => {
      if (typeof hudDefinition.show === "function") {
        return hudDefinition.show(setHud, props, overrides);
      }
      return null;
    };

    const hide = (targetId?: string) => {
      if (typeof hudDefinition.hide === "function") {
        hudDefinition.hide(clearHud, targetId);
      } else {
        clearHud(targetId || hudDefinition.id);
      }
    };

    return {
      clear: clearHud,
      hide,
      show,
    };
  }, [clearHud, hudDefinition, setHud]);
}

export function useDockHudLifecycle({
  clearHud,
  descriptor,
  setHud,
}: {
  clearHud: (id?: string) => void;
  descriptor: unknown;
  setHud: (descriptor: DockHudDescriptor) => void;
}) {
  const activeRef = useRef<string | null>(null);
  const previousRef = useRef<DockHudDescriptor | null>(null);

  useEffect(() => {
    const definition = createHudDefinition(descriptor);
    if (!definition?.isActive) {
      if (activeRef.current) clearHud(activeRef.current);
      activeRef.current = null;
      previousRef.current = null;
      return;
    }
    if (areHudDefinitionsEqual(previousRef.current, definition)) return;
    activeRef.current = definition.id;
    previousRef.current = definition;
    setHud(definition);
  }, [clearHud, descriptor, setHud]);

  useEffect(
    () => () => {
      if (activeRef.current) clearHud(activeRef.current);
    },
    [clearHud],
  );
}

export function useDockHudViewModel({
  clearHud,
  hud,
  pathname,
}: {
  clearHud?: ((id?: string) => void) | null;
  hud: DockHudDescriptor | null;
  pathname?: string | null;
}) {
  const previousPathRef = useRef(pathname);
  const dismiss = useCallback(() => {
    hud?.onDismiss?.();
    if (hud?.id) clearHud?.(hud.id);
  }, [clearHud, hud]);
  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    if (hud?.isActive && hud.dismissOnNavigate && hud.id) clearHud?.(hud.id);
  }, [clearHud, hud?.dismissOnNavigate, hud?.id, hud?.isActive, pathname]);
  useEffect(() => {
    if (!hud?.isActive || !hud?.dismissOnEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      dismiss();
    };
    window.addEventListener("keydown", onKeyDown, {
      capture: true,
    });
    return () =>
      window.removeEventListener("keydown", onKeyDown, {
        capture: true,
      });
  }, [dismiss, hud?.dismissOnEscape, hud?.isActive]);
  useEffect(() => {
    if (!hud?.isActive || !hud?.autoDismissMs) return;
    const timer = setTimeout(dismiss, hud.autoDismissMs);
    return () => clearTimeout(timer);
  }, [dismiss, hud?.autoDismissMs, hud?.isActive]);

  return { dismiss };
}
