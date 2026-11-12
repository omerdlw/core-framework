"use client";

import { motion } from "motion/react";

import { cn } from "@/foundation/recipes/cn";

import { useModalContainerModel } from "../hooks";
import { hasSlotContent } from "../model/header";
import { hasHeightConstraint, isSidePosition } from "../model/layout";
import { useModalMotion } from "../motion";
import {
  type ModalContainerFooterConfig,
  type ModalContainerProps,
} from "../types";
import { resolveHeader } from "./resolve-header";
import { SlotRow } from "./slot-row";

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
      data-height={
        isSidePosition(resolvedPosition)
          ? "full"
          : hasHeightConstraint(className)
            ? undefined
            : "capped"
      }
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
