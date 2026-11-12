"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";

import { globalEvents } from "@/foundation/events";
import { report } from "@/foundation/utils";

import { DOCK_EVENTS } from "../constants";
import { DockContext } from "../context";
import type {
  DockActions,
  DockGuard,
  DockGuardRegistry,
  DockRoutePolicy,
  GuardCheckResult,
  UseDockGuardOptions,
} from "../types";

const DEFAULT_LEAVE_MESSAGE = "Are you sure you want to leave this page?";
const DEFAULT_UNSAVED_MESSAGE =
  "You have unsaved changes. Are you sure you want to leave?";

type GuardWhen = UseDockGuardOptions["when"];

function resolveGuardWhen(when: GuardWhen) {
  return typeof when === "function" ? when() : Boolean(when);
}

async function evaluateGuard(
  guard: DockGuard,
  to: string,
  from: string,
): Promise<{ reason: GuardCheckResult["reason"]; shouldBlock: boolean }> {
  try {
    const shouldBlock = Boolean(
      await Promise.resolve(
        typeof guard.when === "function" ? guard.when(to, from) : guard.when,
      ),
    );
    return { reason: "blocked", shouldBlock };
  } catch (error) {
    report("Dock guard evaluation", error);
    return { reason: "error", shouldBlock: true };
  }
}

/**
 * Creates the registry that holds active navigation guards and checks them,
 * in registration order, before a navigation is allowed.
 */
export function createDockGuardRegistry(): DockGuardRegistry {
  const guards = new Map<number, DockGuard>();
  let nextId = 0;

  return {
    async check(to, from) {
      for (const [id, guard] of guards) {
        const { reason, shouldBlock } = await evaluateGuard(guard, to, from);

        if (shouldBlock) {
          const message = guard.message || DEFAULT_LEAVE_MESSAGE;
          try {
            guard.onBlock?.({ to, from, guardId: id, message });
          } catch (error) {
            report("Dock guard block handler", error);
          }
          return { message, blocked: true, guardId: id, reason };
        }
      }
      return { blocked: false };
    },
    clear() {
      guards.clear();
      nextId = 0;
    },
    count: () => guards.size,
    register(guard) {
      const id = ++nextId;
      guards.set(id, guard);
      return () => {
        guards.delete(id);
      };
    },
  };
}

/**
 * Blocks navigation while `when` is truthy (or returns true) and warns before
 * the page unloads. Returns the guard state with `setGuard` and `clearGuard`.
 */
export function useDockGuard(options: UseDockGuardOptions = {}) {
  const { message = DEFAULT_UNSAVED_MESSAGE, when = false, onBlock } = options;

  const whenRef = useRef(when);
  const [isActive, setIsActive] = useState(Boolean(when));
  const [previousWhen, setPreviousWhen] = useState(() => when);
  if (previousWhen !== when) {
    setPreviousWhen(() => when);
    setIsActive(Boolean(when));
  }

  useEffect(() => {
    whenRef.current = when;
    if (!when) globalEvents.emit(DOCK_EVENTS.GUARD, { clear: true });
  }, [when]);

  const guards = use(DockContext)?.guards ?? null;

  useEffect(() => {
    if (!guards) return;
    const unregister = guards.register({
      when: () => resolveGuardWhen(whenRef.current),
      message,
      onBlock,
    });
    return () => {
      unregister();
      globalEvents.emit(DOCK_EVENTS.GUARD, { clear: true });
    };
  }, [guards, message, onBlock]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      let isBlocked = true;
      try {
        isBlocked = Boolean(resolveGuardWhen(whenRef.current));
      } catch (error) {
        report("Dock guard evaluation", error);
      }
      if (isBlocked) {
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [message]);

  const setGuard = useCallback(
    (
      active:
        boolean | ((to?: string, from?: string) => boolean | Promise<boolean>),
    ) => {
      whenRef.current = active;
      setIsActive(Boolean(active));
      if (!active) globalEvents.emit(DOCK_EVENTS.GUARD, { clear: true });
    },
    [],
  );

  const clearGuard = useCallback(() => {
    whenRef.current = false;
    setIsActive(false);
    globalEvents.emit(DOCK_EVENTS.GUARD, { clear: true });
  }, []);

  return { isActive, clearGuard, setGuard };
}

/** Emits the confirmation prompt for a navigation a guard blocked. */
export function openDockGuardConfirmation({
  closeSurface,
  commit,
  from,
  href,
  message,
  routePolicy,
}: {
  closeSurface: DockActions["closeSurface"];
  commit: (options: {
    from: string;
    href: string;
    routePolicy: DockRoutePolicy;
    source: string;
  }) => unknown;
  from: string;
  href: string;
  message?: string;
  routePolicy: DockRoutePolicy;
}) {
  globalEvents.emit(DOCK_EVENTS.GUARD, {
    to: href,
    from,
    title: "Navigation Blocked",
    message: message || DEFAULT_UNSAVED_MESSAGE,
    icon: "solar:danger-triangle-bold",
    cancelText: "Stay",
    confirmText: "Leave",
    onCancel: () => {
      globalEvents.emit(DOCK_EVENTS.GUARD, { clear: true });
      closeSurface({ cancelled: true, reason: "guard", success: false });
    },
    onConfirm: () => {
      globalEvents.emit(DOCK_EVENTS.GUARD, { clear: true });
      commit({ from, href, routePolicy, source: "guard-confirmation" });
    },
  });
}
