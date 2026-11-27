"use client";

import { AnimatePresence, motion } from "motion/react";
import { createElement } from "react";
import { createPortal } from "react-dom";

import { ModuleBoundary } from "@/core/kernel";
import { cn } from "@/foundation/recipes/cn";
import { Button } from "@/react/ui/components/button";

import { MODAL_POSITIONS, type Theme } from "./constants";
import { useModalLayerModel, useModalModel } from "./hooks";
import { getModalLayout, getModalPosition } from "./layout";
import {
  getModalPositionMotion,
  MODAL_COMPOSITOR_STYLE,
  useModalMotion,
} from "./motion";
import { getModalLabel } from "./state";
import type { ModalComponent, ModalEntry, ModalPosition } from "./types";

/**
 * Renders the open modal stack, with backdrop, in a portal on the document body.
 * Mounted once by the modal module as the app overlay.
 */
export function Modal() {
  const {
    closeModal,
    registry,
    visibleModalStack,
    topModalEntry,
    isModalVisible,
    mounted,
    isMobileViewport,
    isTopExitSettling,
    setIsTopExitSettling,
    theme,
  } = useModalModel();
  const modalMotion = useModalMotion();
  if (!mounted) return null;
  return createPortal(
    <>
      <AnimatePresence>
        {isModalVisible && (
          <motion.div
            key="global-modal-backdrop"
            variants={modalMotion.backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={theme.slots.backdrop}
            style={theme.styles.backdrop}
            onClick={() => {
              if (!isTopExitSettling) closeModal(null, topModalEntry.id);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence onExitComplete={() => setIsTopExitSettling(false)}>
        {visibleModalStack.map((entry: ModalEntry, index: number) => (
          <ModalLayer
            key={entry.id}
            entry={entry}
            stackIndex={index}
            isTopModal={
              index === visibleModalStack.length - 1 && !isTopExitSettling
            }
            isMobileViewport={isMobileViewport}
            closeModal={closeModal}
            registry={registry}
            modalStack={visibleModalStack}
            theme={theme}
          />
        ))}
      </AnimatePresence>
    </>,
    document.body,
  );
}

interface ModalLayerProps {
  closeModal: (result?: unknown, targetModalId?: number | null) => void;
  entry: ModalEntry;
  isMobileViewport: boolean;
  isTopModal: boolean;
  modalStack: ModalEntry[];
  registry: { get: (key: string) => ModalComponent | undefined };
  stackIndex: number;
  theme: Theme;
}

type ModalLayerContentProps = Pick<
  ModalLayerProps,
  "closeModal" | "entry" | "isTopModal" | "modalStack" | "stackIndex" | "theme"
> & {
  activePosition: ModalPosition;
  ActiveModalComponent: ModalComponent;
  previousEntry: ModalEntry | null;
};

function ModalLayerContent({
  ActiveModalComponent,
  activePosition,
  closeModal,
  entry,
  isTopModal,
  modalStack,
  previousEntry,
  stackIndex,
  theme,
}: ModalLayerContentProps) {
  return (
    <>
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
    </>
  );
}

function ModalLayer({
  closeModal,
  entry,
  isMobileViewport,
  isTopModal,
  modalStack,
  registry,
  stackIndex,
  theme,
}: ModalLayerProps) {
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
          <ModalLayerContent
            ActiveModalComponent={ActiveModalComponent}
            activePosition={activePosition}
            closeModal={closeModal}
            entry={entry}
            isTopModal={isTopModal}
            modalStack={modalStack}
            previousEntry={previousEntry}
            stackIndex={stackIndex}
            theme={theme}
          />
        </div>
      </motion.div>
    </div>
  );
}

function ModalLayerSwitcher({
  currentEntry,
  onSwitchToPrevious,
  previousEntry,
  theme,
}: {
  currentEntry: ModalEntry;
  onSwitchToPrevious: () => void;
  previousEntry: ModalEntry;
  theme: Theme;
}) {
  return (
    <div className={theme.slots.switcher}>
      <Button
        type="button"
        onClick={onSwitchToPrevious}
        className={theme.slots.switcherButton}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M7.5 2.5L4 6l3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {getModalLabel(previousEntry.modalType)}
      </Button>
      <span className={theme.slots.switcherDivider}>/</span>
      <span className={theme.slots.switcherCurrent}>
        {getModalLabel(currentEntry.modalType)}
      </span>
    </div>
  );
}
