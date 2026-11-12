"use client";

import { createElement } from "react";
import { motion } from "motion/react";
import { cn } from "@/foundation/recipes/cn";
import { ModuleBoundary } from "@/core/kernel";
import { MODAL_POSITIONS } from "../constants";
import {
  MODAL_COMPOSITOR_STYLE,
  getModalPositionMotion,
  useModalMotion,
} from "../motion";
import { type ModalComponent, type ModalEntry } from "../types";
import { getModalLayout, getModalPosition } from "../model/layout";
import { useModalLayerModel } from "../hooks";
import { type Theme } from "../lib/theme";
import { ModalLayerSwitcher } from "./modal-layer-switcher";

export function ModalLayer({
  closeModal,
  entry,
  isMobileViewport,
  isTopModal,
  modalStack,
  registry,
  stackIndex,
  theme,
}: {
  closeModal: (result?: unknown, targetModalId?: number | null) => void;
  entry: ModalEntry;
  isMobileViewport: boolean;
  isTopModal: boolean;
  modalStack: ModalEntry[];
  registry: { get: (key: string) => ModalComponent | undefined };
  stackIndex: number;
  theme: Theme;
}) {
  const {
    modalRef,
    activePosition,
    ActiveModalComponent,
    isPanelChrome,
    previousEntry,
  } = useModalLayerModel({
    closeModal,
    entry,
    isMobileViewport,
    isTopModal,
    modalStack,
    registry,
    stackIndex,
  });
  const modalMotion = useModalMotion();
  if (!ActiveModalComponent) return null;
  const layout = getModalLayout(activePosition, isMobileViewport);
  const positionMotion = getModalPositionMotion(
    modalMotion.positions,
    activePosition,
  );
  return (
    <div
      role="dialog"
      aria-modal={isTopModal}
      aria-labelledby={entry.title ? `modal-title-${entry.id}` : undefined}
      data-position={getModalPosition(activePosition)}
      data-inset={
        activePosition === MODAL_POSITIONS.CENTER && !isMobileViewport
          ? true
          : undefined
      }
      className={theme.slots.layer}
      style={theme.styles.layer}
    >
      <motion.div
        ref={modalRef}
        variants={positionMotion.variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={positionMotion.transition}
        data-active={isTopModal}
        data-layout={layout}
        className={theme.slots.frame}
        style={{ zIndex: 1, ...MODAL_COMPOSITOR_STYLE }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          data-layout={layout}
          className={cn(
            theme.slots.panel,
            isPanelChrome ? theme.slots.panelChrome : theme.slots.panelBare,
          )}
        >
          <ModuleBoundary name={entry.modalType}>
            {createElement(ActiveModalComponent, {
              close: (result: unknown) => closeModal(result, entry.id),
              data: entry.props,
              header: {
                actions: entry.headerActions,
                position: activePosition,
                showClose: entry.showClose,
                title: entry.title,
                titleId: `modal-title-${entry.id}`,
              },
            })}
          </ModuleBoundary>

          {!isTopModal && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                const topModal = modalStack[modalStack.length - 1];
                if (topModal) closeModal(null, topModal.id);
              }}
              className={theme.slots.dim}
              style={theme.styles.dim}
              aria-label="Close active top modal"
            />
          )}

          {isTopModal && stackIndex > 0 && previousEntry && (
            <ModalLayerSwitcher
              currentEntry={entry}
              previousEntry={previousEntry}
              theme={theme}
              onSwitchToPrevious={() => closeModal(null, entry.id)}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
