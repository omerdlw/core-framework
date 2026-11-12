"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toArray } from "@/foundation/utils";

import { useDockActions } from "../context";
import type {
  DefineDockActionOptions,
  DockActionDefinition,
  DockActionDescriptor,
  DockActionOverrides,
} from "../types";

export type DockCommandEntry = DockActionDescriptor & { key: string };
const ON_CLICK_FIELD = "onClick";
const DEFAULT_ACTION_KEY = "dock-action";

type DockCommandEntries = Record<string, DockCommandEntry>;
type DockCommandInput =
  DockActionDescriptor | DockActionDescriptor[] | null | undefined;

function createCommandEntries(commands: DockCommandInput): DockCommandEntries {
  const entries: DockCommandEntries = {};
  const cmdArray = toArray(commands);

  for (let i = 0; i < cmdArray.length; i++) {
    const command = cmdArray[i];
    if (!command) continue;
    const key = command.key || `context-action-${i}`;
    entries[key] = { key, ...command };
  }
  return entries;
}

/**
 * Compares the fields named by `fieldsOf`. `onClick` handlers are compared by
 * type only, so a re-created inline handler does not count as a change.
 */
function haveSameCommandFields(
  left: Partial<DockCommandEntry>,
  right: Partial<DockCommandEntry>,
  fieldsOf: Partial<DockCommandEntry>,
): boolean {
  for (const field of Object.keys(fieldsOf) as (keyof DockCommandEntry)[]) {
    if (field === ON_CLICK_FIELD) {
      if (typeof left[field] !== typeof right[field]) return false;
    } else if (left[field] !== right[field]) {
      return false;
    }
  }
  return true;
}

function areCommandEntriesEqual(
  currentEntries: DockCommandEntries,
  nextEntries: DockCommandEntries,
): boolean {
  const currentKeys = Object.keys(currentEntries);
  const nextKeys = Object.keys(nextEntries);

  if (currentKeys.length !== nextKeys.length) return false;

  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i];
    const currentEntry = currentEntries[key];
    const nextEntry = nextEntries[key];

    if (!currentEntry || !nextEntry) return false;

    if (!haveSameCommandFields(currentEntry, nextEntry, nextEntry))
      return false;
  }

  return true;
}

function registerDockCommand(
  currentEntries: DockCommandEntries,
  command: Partial<DockActionDescriptor>,
  key: string,
): DockCommandEntries {
  const existing = currentEntries[key];

  if (existing) {
    if (haveSameCommandFields(existing, command, command)) {
      if (command.onClick && existing.onClick !== command.onClick) {
        return {
          ...currentEntries,
          [key]: { ...existing, onClick: command.onClick },
        };
      }
      return currentEntries;
    }
  }

  return { ...currentEntries, [key]: { key, ...command } };
}

export function useDockCommandRegistry() {
  const [commandEntries, setCommandEntries] = useState<DockCommandEntries>({});
  const generatedCommandIdRef = useRef(0);

  const registerCommand = useCallback(
    (command: Partial<DockActionDescriptor>) => {
      if (!command) return;

      const key =
        command.key || `context-action-${++generatedCommandIdRef.current}`;

      setCommandEntries((currentEntries) =>
        registerDockCommand(currentEntries, command, key),
      );
    },
    [],
  );

  const unregisterCommand = useCallback((key: string) => {
    if (!key) return;
    setCommandEntries((currentEntries) => {
      if (!currentEntries[key]) return currentEntries;
      const { [key]: _, ...nextEntries } = currentEntries;
      return nextEntries;
    });
  }, []);

  const setCommands = useCallback((commands: DockCommandInput) => {
    if (!commands) {
      setCommandEntries({});
      return;
    }
    const nextEntries = createCommandEntries(commands);
    setCommandEntries((currentEntries) =>
      areCommandEntriesEqual(currentEntries, nextEntries)
        ? currentEntries
        : nextEntries,
    );
  }, []);

  const clearCommands = useCallback(() => {
    setCommandEntries((currentEntries) =>
      Object.keys(currentEntries).length === 0 ? currentEntries : {},
    );
  }, []);

  const contextCommands = useMemo(
    () => Object.values(commandEntries),
    [commandEntries],
  );

  const actions = useMemo(
    () => ({
      clearContextActions: clearCommands,
      registerContextAction: registerCommand,
      setContextActions: setCommands,
      unregisterContextAction: unregisterCommand,
    }),
    [clearCommands, registerCommand, setCommands, unregisterCommand],
  );

  return { actions, contextActions: contextCommands };
}

/**
 * Registers the given actions as dock context actions while the component is
 * mounted and removes the ones that are no longer passed.
 */
export function useDockContextActions(
  actions: Partial<DockActionDescriptor> | Partial<DockActionDescriptor>[],
) {
  const { registerContextAction, unregisterContextAction } = useDockActions();
  const registeredKeysRef = useRef(new Set<string>());

  useEffect(() => {
    const currentKeys = new Set<string>();
    toArray(actions).forEach((action, index: number) => {
      if (!action) return;
      const key = action.key || `ctx-action-${index}`;
      currentKeys.add(key);
      registerContextAction({ key, ...action });
    });

    registeredKeysRef.current.forEach((prevKey) => {
      if (!currentKeys.has(prevKey)) unregisterContextAction(prevKey);
    });
    registeredKeysRef.current = currentKeys;
  }, [actions, registerContextAction, unregisterContextAction]);

  useEffect(() => {
    return () => {
      registeredKeysRef.current.forEach(unregisterContextAction);
      registeredKeysRef.current.clear();
    };
  }, [unregisterContextAction]);
}

function resolveActionSettings(definition: DefineDockActionOptions) {
  const {
    badge = null,
    className = null,
    disabled = false,
    icon = null,
    key = DEFAULT_ACTION_KEY,
    onClick = null,
    order = 0,
    tone = null,
    tooltip = null,
    visible = true,
    ...extraConfig
  } = definition;

  return {
    badge,
    className,
    disabled,
    extraConfig,
    icon,
    key,
    onClick,
    order,
    tone,
    tooltip,
    visible,
  };
}

/**
 * Defines a reusable dock action. `create` builds the descriptor (a function
 * argument is treated as the click handler) and `use()` registers it as a
 * context action while the calling component is mounted.
 */
export function defineDockAction(
  definition: DefineDockActionOptions = {},
): DockActionDefinition {
  const settings = resolveActionSettings(definition);
  const { extraConfig, key } = settings;

  const createAction = (
    overrides: DockActionOverrides = {},
  ): DockActionDescriptor => {
    const resolvedOverrides =
      typeof overrides === "function" ? { onClick: overrides } : overrides;
    return {
      key,
      icon: settings.icon,
      tooltip: settings.tooltip,
      order: settings.order,
      disabled: settings.disabled,
      visible: settings.visible,
      badge: settings.badge,
      className: settings.className,
      tone: settings.tone,
      onClick: settings.onClick,
      ...extraConfig,
      ...resolvedOverrides,
    };
  };

  return Object.freeze({
    bind: createAction,
    config: {
      badge: settings.badge,
      className: settings.className,
      disabled: settings.disabled,
      icon: settings.icon,
      key,
      onClick: settings.onClick,
      order: settings.order,
      tone: settings.tone,
      tooltip: settings.tooltip,
      visible: settings.visible,
      ...extraConfig,
    },
    create: createAction,
    id: key,
    key,
    use: function useDefinedDockAction(overrides: DockActionOverrides = {}) {
      const action = createAction(overrides);
      useDockContextActions([action]);
    },
  });
}
