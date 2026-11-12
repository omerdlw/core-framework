"use client";

import { AnimatePresence, motion } from "motion/react";
import { type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/foundation/recipes/cn";

import { DOCK_STACK_ELEMENT_ID } from "./constants";
import { NotificationListener, useNotificationContainerModel } from "./hooks";
import { NOTIFICATION_COMPOSITOR_STYLE, useNotificationMotion } from "./motion";
import { type NotificationEntry } from "./types";

interface ToastProps {
  className: string;
  entry: NotificationEntry;
  messageClassName: string;
  onDismiss: () => void;
  polite?: boolean;
  style?: CSSProperties;
}

function Toast({
  className,
  entry,
  messageClassName,
  onDismiss,
  polite,
  style,
}: ToastProps) {
  const toastMotion = useNotificationMotion();
  return (
    <motion.div
      role="alert"
      aria-atomic="true"
      aria-live={polite ? "polite" : undefined}
      aria-keyshortcuts="Escape"
      tabIndex={0}
      variants={toastMotion.toast}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={toastMotion.transition}
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
  const renderToast = (className: string, polite?: boolean) => (
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
      renderToast(cn(theme.slots.toast, theme.slots.toastDocked), true),
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
      {renderToast(theme.slots.toast)}
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
