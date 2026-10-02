"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { globalEvents } from "@/events";
import { DOCK_EVENTS } from "../constants";
import { DockContext } from "../context";
import {
  type DockGuard,
  type GuardCheckResult,
  type UseDockGuardOptions,
  type DockActions,
  type DockGuardRegistry,
  type DockRoutePolicy,
} from "../types";
import { report } from "@/utils";

export function createDockGuardRegistry(): DockGuardRegistry {
  const guards = new Map<number, DockGuard>();
  let nextId = 0;

  return {
    async check(to, from) {
      for (const [id, guard] of guards) {
        let shouldBlock = false;
        let reason: GuardCheckResult["reason"] = "blocked";
        try {
          shouldBlock = Boolean(
            await Promise.resolve(
              typeof guard.when === "function"
                ? guard.when(to, from)
                : guard.when,
            ),
          );
        } catch (error) {
          report("Dock guard evaluation", error);
          shouldBlock = true;
          reason = "error";
        }

        if (shouldBlock) {
          const message =
            guard.message || "Are you sure you want to leave this page?";
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

export function useDockGuard(options: UseDockGuardOptions = {}) {
  const {
    message = "You have unsaved changes. Are you sure you want to leave?",
    when = false,
    onBlock,
  } = options;

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
      when: () =>
        typeof whenRef.current === "function"
          ? whenRef.current()
          : Boolean(whenRef.current),
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
        isBlocked =
          typeof whenRef.current === "function"
            ? Boolean(whenRef.current())
            : Boolean(whenRef.current);
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
  }) => boolean;
  from: string;
  href: string;
  message?: string;
  routePolicy: DockRoutePolicy;
}) {
  globalEvents.emit(DOCK_EVENTS.GUARD, {
    to: href,
    from,
    title: "Navigation Blocked",
    message:
      message || "You have unsaved changes. Are you sure you want to leave?",
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
