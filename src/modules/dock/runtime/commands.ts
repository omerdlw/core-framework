"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { toArray } from "@/utils";
import {
  type DockActionDescriptor,
  type DockActionDefinition,
  type DockActionOverrides,
  type DefineDockActionOptions,
} from "../types";
import { useDockActions } from "../context";

export type DockCommandEntry = DockActionDescriptor & { key: string };
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

    for (const entryKey of Object.keys(
      nextEntry,
    ) as (keyof DockCommandEntry)[]) {
      if (entryKey === "onClick") {
        if (typeof currentEntry[entryKey] !== typeof nextEntry[entryKey])
          return false;
      } else if (currentEntry[entryKey] !== nextEntry[entryKey]) {
        return false;
      }
    }
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
    let isSame = true;
    for (const entryKey of Object.keys(
      command,
    ) as (keyof DockActionDescriptor)[]) {
      if (entryKey === "onClick") {
        if (typeof command[entryKey] !== typeof existing[entryKey]) {
          isSame = false;
          break;
        }
      } else if (existing[entryKey] !== command[entryKey]) {
        isSame = false;
        break;
      }
    }

    if (isSame) {
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

export function defineDockAction(
  definition: DefineDockActionOptions = {},
): DockActionDefinition {
  const {
    badge = null,
    className = null,
    disabled = false,
    icon = null,
    key = "dock-action",
    onClick = null,
    order = 0,
    tone = null,
    tooltip = null,
    visible = true,
    ...extraConfig
  } = definition;

  const createAction = (
    overrides: DockActionOverrides = {},
  ): DockActionDescriptor => {
    const resolvedOverrides =
      typeof overrides === "function" ? { onClick: overrides } : overrides;
    return {
      key,
      icon,
      tooltip,
      order,
      disabled,
      visible,
      badge,
      className,
      tone,
      onClick,
      ...extraConfig,
      ...resolvedOverrides,
    };
  };

  return Object.freeze({
    bind: createAction,
    config: {
      badge,
      className,
      disabled,
      icon,
      key,
      onClick,
      order,
      tone,
      tooltip,
      visible,
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
