"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/foundation/recipes/cn";
import { Button } from "@/react/ui/components/button";
import { Icon } from "@/react/ui/components/icon";

import type { Theme } from "./constants";
import { useModalContainerModel } from "./hooks";
import { hasHeightConstraint, isSidePosition } from "./layout";
import { useModalMotion } from "./motion";
import { hasSlotContent, isHeaderConfig, resolveHeaderActions } from "./state";
import type {
  ModalContainerFooterConfig,
  ModalContainerHeaderConfig,
  ModalContainerProps,
  ModalPosition,
} from "./types";

function resolveContentHeight(
  position: ModalPosition | null,
  className?: string,
) {
  if (isSidePosition(position)) return "full";
  return hasHeightConstraint(className) ? undefined : "capped";
}

/**
 * Standard modal body: an optional header and footer row around the content,
 * laid out for the modal's position.
 */
export function ModalContainer({
  bodyClassName,
  children,
  className,
  close,
  footer,
  header = {},
  position = null,
}: ModalContainerProps) {
  const { theme } = useModalContainerModel();
  const modalMotion = useModalMotion();
  const headerRow =
    header === false ? null : resolveHeader(header, close, theme);
  const shouldRenderHeader =
    headerRow &&
    [headerRow.left, headerRow.center, headerRow.right].some(hasSlotContent);

  const footerConfig: ModalContainerFooterConfig =
    footer && typeof footer === "object"
      ? (footer as ModalContainerFooterConfig)
      : {};
  const {
    center: footerCenter = null,
    left: footerLeft = null,
    right: footerRight = null,
  } = footerConfig;
  const shouldRenderFooter =
    footer !== false &&
    [footerLeft, footerCenter, footerRight].some(hasSlotContent);

  const resolvedPosition = position || headerRow?.config.position || null;

  return (
    <div
      data-height={resolveContentHeight(resolvedPosition, className)}
      className={cn(theme.slots.content, className)}
    >
      {shouldRenderHeader && (
        <SlotRow
          variants={modalMotion.header}
          left={headerRow.left}
          center={headerRow.center}
          right={headerRow.right}
          theme={theme}
          sticky={headerRow.config.sticky ? "top" : undefined}
        />
      )}

      <motion.div
        variants={modalMotion.content}
        initial="hidden"
        animate="visible"
        data-lenis-prevent
        data-lenis-prevent-wheel
        className={cn(theme.slots.body, bodyClassName)}
      >
        {children}
      </motion.div>

      {shouldRenderFooter && (
        <SlotRow
          variants={modalMotion.footer}
          left={footerLeft}
          center={footerCenter}
          right={footerRight}
          theme={theme}
          sticky={footerConfig.sticky ? "bottom" : undefined}
        />
      )}
    </div>
  );
}

function resolveLeftSlot(
  config: ModalContainerHeaderConfig,
  customNode: ReactNode,
  theme: Theme,
) {
  if (customNode !== null) return null;
  if (config.left !== null && config.left !== undefined) return config.left;
  if (!config.title) return null;
  return (
    <h2 id={config.titleId} className={theme.slots.title}>
      {config.title}
    </h2>
  );
}

function resolveRightSlot({
  actions,
  close,
  config,
  customNode,
  showClose,
  theme,
}: {
  actions: ReactNode;
  close: ModalContainerProps["close"];
  config: ModalContainerHeaderConfig;
  customNode: ReactNode;
  showClose: boolean;
  theme: Theme;
}) {
  if (customNode !== null) return null;
  if (config.right !== null && config.right !== undefined) return config.right;
  if (!hasSlotContent(actions) && !showClose) return null;
  return (
    <>
      {actions}
      {showClose && <CloseButton close={close} theme={theme} />}
    </>
  );
}

export function resolveHeader(
  header: ModalContainerProps["header"],
  close: ModalContainerProps["close"],
  theme: Theme,
) {
  const config: ModalContainerHeaderConfig = isHeaderConfig(header)
    ? (header as ModalContainerHeaderConfig)
    : {};
  const customNode =
    typeof header !== "boolean" &&
    !isHeaderConfig(header) &&
    hasSlotContent(header)
      ? (header as ReactNode)
      : null;
  const actions = resolveHeaderActions(config.actions, close);
  const showClose = config.showClose === true;

  const left = resolveLeftSlot(config, customNode, theme);
  const right = resolveRightSlot({
    actions,
    close,
    config,
    customNode,
    showClose,
    theme,
  });

  return { center: customNode ?? config.center ?? null, config, left, right };
}

export function SlotRow({
  center,
  left,
  right,
  sticky,
  theme,
  variants,
}: {
  center: ReactNode;
  left: ReactNode;
  right: ReactNode;
  sticky?: "top" | "bottom";
  theme: Theme;
  variants: Variants;
}) {
  const hasCenter = hasSlotContent(center);
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      data-columns={hasCenter ? 3 : 2}
      data-sticky={sticky}
      className={theme.slots.row}
      style={sticky ? theme.styles.row : undefined}
    >
      <div className={theme.slots.rowStart}>{left}</div>
      {hasCenter && <div className={theme.slots.rowCenter}>{center}</div>}
      <div className={theme.slots.rowEnd}>{right}</div>
    </motion.div>
  );
}

export function CloseButton({
  close,
  theme,
}: {
  close?: (result?: unknown) => void;
  theme: Theme;
}) {
  if (typeof close !== "function") return null;
  return (
    <Button
      type="button"
      aria-label="Close modal"
      onClick={close}
      className={theme.slots.closeButton}
    >
      <Icon icon="solar:close-bold" size={16} />
    </Button>
  );
}
