"use client";

import { useEffect, useMemo, useRef } from "react";

import { DOCK_HUD_PRIORITY } from "./constants";
import { useDockActions } from "./context";
import { areHudDefinitionsEqual } from "./model/hud";
import { createHudDefinition } from "./model/hud-definition";
import type {
  DefineHudOptions,
  DockComponentProps,
  DockHudDefinition,
  DockHudDescriptor,
  DockHudOverrides,
  DockHudTrigger,
  UseHudReturn,
} from "./types";

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
