"use client";

import { motion } from "motion/react";
import { cn } from "@/foundation/recipes/cn";
import { Button } from "@/react/ui/components/button";
import { useRouter } from "next/navigation";
import { useDockMotion } from "../motion";
import type { ErrorActionsProps, GuardActionsProps } from "../types";
import { useDockActionClass, useDockTheme } from "../hooks/use-dock-theme";
import { useDockActions } from "../context";

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
  const actionClass = useDockActionClass();
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
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onRefresh?.();
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>{effectiveRefresh}</span>
      </Button>
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onRetry?.();
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>{effectiveRetry}</span>
      </Button>
    </motion.div>
  );
}

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
  const actionClass = useDockActionClass();
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
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onCancel?.();
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>{effectiveCancel}</span>
      </Button>
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onConfirm?.();
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>{effectiveConfirm}</span>
      </Button>
    </motion.div>
  );
}

export function NotFoundActions({ className = "" }: { className?: string }) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  const actionClass = useDockActionClass();
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
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          router.back();
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>Go back</span>
      </Button>
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          void navigate("/", { force: true });
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>Home</span>
      </Button>
    </motion.div>
  );
}
