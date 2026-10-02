"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRequiredContext } from "@/hooks";
import type {
  RegistryDefinitions,
  RegistrySchema,
  RegistryStore,
} from "./types";
import { createRegistryStore, type InitialRegistryEntries } from "./store";

type RegistryValueOf<K extends string> = K extends keyof RegistrySchema
  ? RegistrySchema[K]
  : unknown;

interface RegistryContextValue {
  actions: Pick<
    RegistryStore,
    "batch" | "register" | "transaction" | "unregister"
  >;
  subscription: Pick<
    RegistryStore,
    "getEntriesSnapshot" | "getSnapshot" | "subscribe"
  >;
}
import { getOrCreateGlobalContext } from "./context-registry";

const RegistryContext = getOrCreateGlobalContext<RegistryContextValue | null>(
  "RegistryContext",
  null,
);

export function RegistryProvider({
  children,
  definitions,
  initialEntries = [],
}: {
  children?: ReactNode;
  definitions?: RegistryDefinitions;
  initialEntries?: InitialRegistryEntries;
}) {
  const [store] = useState(() =>
    createRegistryStore(initialEntries, definitions),
  );

  const contextValue = useMemo(
    () => ({
      actions: {
        batch: store.batch,
        register: store.register,
        transaction: store.transaction,
        unregister: store.unregister,
      },
      subscription: {
        getEntriesSnapshot: store.getEntriesSnapshot,
        getSnapshot: store.getSnapshot,
        subscribe: store.subscribe,
      },
    }),
    [store],
  );

  return <RegistryContext value={contextValue}>{children}</RegistryContext>;
}

export function useRegistryActions(): RegistryContextValue["actions"] {
  return useRequiredContext(
    RegistryContext,
    "useRegistryActions",
    "RegistryProvider",
  ).actions;
}

function useRegistrySubscription(): RegistryContextValue["subscription"] {
  return useRequiredContext(
    RegistryContext,
    "useRegistrySubscription",
    "RegistryProvider",
  ).subscription;
}

export function useRegistryValue<
  K extends string = string,
  T = RegistryValueOf<K>,
>(type: K, key: string): T | undefined {
  const { getSnapshot, subscribe } = useRegistrySubscription();

  const subscribeToKey = useCallback(
    (listener: () => void) => subscribe(type, key, listener),
    [key, subscribe, type],
  );
  const getValue = useCallback(
    () => getSnapshot<K, T>(type, key),
    [getSnapshot, key, type],
  );

  return useSyncExternalStore(subscribeToKey, getValue, getValue);
}

export function useRegistryEntries<
  K extends string = string,
  T = RegistryValueOf<K>,
>(type: K): Record<string, T> {
  const { getEntriesSnapshot, subscribe } = useRegistrySubscription();

  const subscribeToType = useCallback(
    (listener: () => void) => subscribe(type, null, listener),
    [subscribe, type],
  );
  const getEntries = useCallback(
    () => getEntriesSnapshot<K, T>(type),
    [getEntriesSnapshot, type],
  );

  return useSyncExternalStore(subscribeToType, getEntries, getEntries);
}
