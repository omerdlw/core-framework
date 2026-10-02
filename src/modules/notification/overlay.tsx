"use client";

import { type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { type CSSProperties } from "react";
import { cn } from "@/utils";
import { DOCK_STACK_ELEMENT_ID } from "./constants";
import { type NotificationEntry } from "./types";
import {
  NOTIFICATION_COMPOSITOR_STYLE,
  NOTIFICATION_TRANSITION,
  toastVariants,
} from "./motion";
import { useNotificationContainerModel, NotificationListener } from "./hooks";

function Toast({
  className,
  entry,
  messageClassName,
  onDismiss,
  polite,
  style,
}: {
  className: string;
  entry: NotificationEntry;
  messageClassName: string;
  onDismiss: () => void;
  polite?: boolean;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      role="alert"
      aria-atomic="true"
      aria-live={polite ? "polite" : undefined}
      aria-keyshortcuts="Escape"
      tabIndex={0}
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={NOTIFICATION_TRANSITION}
      style={{ ...NOTIFICATION_COMPOSITOR_STYLE, ...style }}
      className={className}
      onClick={(event: MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        onDismiss();
      }}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }}
    >
      <div className={messageClassName}>{entry.message}</div>
    </motion.div>
  );
}

export function NotificationContainer() {
  const { dismissNotification, isHydrated, activeEntry, theme } =
    useNotificationContainerModel();
  if (!isHydrated) return null;
  const dockElement = document.getElementById(DOCK_STACK_ELEMENT_ID);
  const toast = (className: string, polite?: boolean) => (
    <AnimatePresence mode="wait">
      {activeEntry && (
        <Toast
          key={activeEntry.id}
          className={className}
          entry={activeEntry}
          messageClassName={theme.slots.toastMessage}
          polite={polite}
          style={theme.styles.toast}
          onDismiss={() => dismissNotification(activeEntry.id)}
        />
      )}
    </AnimatePresence>
  );
  if (dockElement) {
    return createPortal(
      toast(cn(theme.slots.toast, theme.slots.toastDocked), true),
      dockElement,
    );
  }
  return createPortal(
    <div
      aria-atomic="true"
      aria-live="polite"
      className={theme.slots.layer}
      style={theme.styles.layer}
    >
      {toast(theme.slots.toast)}
    </div>,
    document.body,
  );
}

export function NotificationLayer() {
  return (
    <>
      <NotificationListener />
      <NotificationContainer />
    </>
  );
}
