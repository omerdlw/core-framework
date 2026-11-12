"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";

import { getOrCreateGlobalContext } from "@/react/context";
import { useRequiredContext } from "@/react/hooks";

import { createRegistryStore } from "./store";
import { type InitialRegistryEntries } from "./store-entries";
import type {
  RegistryDefinitions,
  RegistrySchema,
  RegistryStore,
} from "./types";

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

type RegistrySubscription = RegistryContextValue["subscription"];

interface KeyedSubscription {
  getSnapshot: () => unknown;
  subscribe: (listener: () => void) => () => void;
}

// One subscribe/getSnapshot pair per registry and id, so useSyncExternalStore
// gets stable functions without hand-written memos.
const keyedSubscriptions = new WeakMap<
  RegistrySubscription,
  Map<string, KeyedSubscription>
>();

function keyedSubscription(
  subscription: RegistrySubscription,
  id: string,
  create: () => KeyedSubscription,
): KeyedSubscription {
  let byId = keyedSubscriptions.get(subscription);
  if (!byId) {
    byId = new Map();
    keyedSubscriptions.set(subscription, byId);
  }
  let entry = byId.get(id);
  if (!entry) {
    entry = create();
    byId.set(id, entry);
  }
  return entry;
}

function createRegistryContextValue(
  store: RegistryStore,
): RegistryContextValue {
  return {
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
  };
}

const RegistryContext = getOrCreateGlobalContext<RegistryContextValue | null>(
  "RegistryContext",
  null,
);

interface RegistryProviderProps {
  children?: ReactNode;
  definitions?: RegistryDefinitions;
  initialEntries?: InitialRegistryEntries;
}

/**
 * Provides a registry store, optionally seeded with initial entries, to its
 * subtree.
 */
export function RegistryProvider({
  children,
  definitions,
  initialEntries = [],
}: RegistryProviderProps) {
  const [contextValue] = useState(() =>
    createRegistryContextValue(
      createRegistryStore(initialEntries, definitions),
    ),
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

/**
 * Subscribes to the resolved value of one registry key.
 */
export function useRegistryValue<
  K extends string = string,
  T = RegistryValueOf<K>,
>(type: K, key: string): T | undefined {
  const subscription = useRegistrySubscription();
  const { getSnapshot, subscribe } = keyedSubscription(
    subscription,
    `value\u0000${type}\u0000${key}`,
    () => ({
      getSnapshot: () => subscription.getSnapshot<K, T>(type, key),
      subscribe: (listener) => subscription.subscribe(type, key, listener),
    }),
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as
    T | undefined;
}

/**
 * Subscribes to all resolved entries of a registry type.
 */
export function useRegistryEntries<
  K extends string = string,
  T = RegistryValueOf<K>,
>(type: K): Record<string, T> {
  const subscription = useRegistrySubscription();
  const { getSnapshot, subscribe } = keyedSubscription(
    subscription,
    `entries\u0000${type}`,
    () => ({
      getSnapshot: () => subscription.getEntriesSnapshot<K, T>(type),
      subscribe: (listener) => subscription.subscribe(type, null, listener),
    }),
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as Record<
    string,
    T
  >;
}
