"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/foundation/recipes/cn";
import { Button } from "@/react/ui/components/button";

import { useDockActions } from "../context";
import { useDockActionClass, useDockTheme } from "../hooks/use-dock-theme";
import { useDockMotion } from "../motion";
import type { ErrorActionsProps, GuardActionsProps } from "../types";

interface ActionButtonProps {
  children: ReactNode;
  onPress: () => void;
}

function ActionButton({ children, onPress }: ActionButtonProps) {
  const theme = useDockTheme();
  const actionClass = useDockActionClass();
  return (
    <Button
      type="button"
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onPress();
      }}
      className={actionClass({
        variant: theme.slots.actionMuted,
        className: theme.slots.actionFill,
      })}
    >
      <span className={theme.slots.actionLabel}>{children}</span>
    </Button>
  );
}

/** Retry and refresh buttons for an error status card. */
export function ErrorActions({
  onRetry,
  onRefresh,
  retryLabel = "Retry",
  refreshLabel = "Refresh",
  retryText,
  refreshText,
  className = "",
}: ErrorActionsProps) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  const effectiveRetry = retryLabel || retryText || "Retry";
  const effectiveRefresh = refreshLabel || refreshText || "Refresh";
  return (
    <motion.div
      variants={dockMotion.variants.textCrossfade}
      initial="hidden"
      animate="visible"
      transition={dockMotion.transitions.fade}
      className={cn(theme.slots.actionRow, className)}
    >
      <ActionButton
        onPress={() => {
          onRefresh?.();
        }}
      >
        {effectiveRefresh}
      </ActionButton>
      <ActionButton
        onPress={() => {
          onRetry?.();
        }}
      >
        {effectiveRetry}
      </ActionButton>
    </motion.div>
  );
}

/** Cancel and confirm buttons for a navigation-guard status card. */
export function GuardActions({
  onCancel,
  onConfirm,
  cancelLabel = "Stay",
  confirmLabel = "Leave",
  cancelText,
  confirmText,
  className = "",
}: GuardActionsProps) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  const effectiveCancel = cancelLabel || cancelText || "Stay";
  const effectiveConfirm = confirmLabel || confirmText || "Leave";
  return (
    <motion.div
      variants={dockMotion.variants.textCrossfade}
      initial="hidden"
      animate="visible"
      transition={dockMotion.transitions.fade}
      className={cn(theme.slots.actionRow, className)}
    >
      <ActionButton
        onPress={() => {
          onCancel?.();
        }}
      >
        {effectiveCancel}
      </ActionButton>
      <ActionButton
        onPress={() => {
          onConfirm?.();
        }}
      >
        {effectiveConfirm}
      </ActionButton>
    </motion.div>
  );
}

/** Go-back and home buttons for a not-found status card. */
export function NotFoundActions({ className = "" }: { className?: string }) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  const router = useRouter();
  const { navigate } = useDockActions();
  return (
    <motion.div
      variants={dockMotion.variants.textCrossfade}
      initial="hidden"
      animate="visible"
      transition={dockMotion.transitions.fade}
      className={cn(theme.slots.actionRow, className)}
    >
      <ActionButton
        onPress={() => {
          router.back();
        }}
      >
        Go back
      </ActionButton>
      <ActionButton
        onPress={() => {
          void navigate("/", { force: true });
        }}
      >
        Home
      </ActionButton>
    </motion.div>
  );
}
