"use client";

import { createElement, type ReactNode } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { Button, Icon } from "@/atoms";
import { Z_INDEX } from "@/tokens";
import { cn } from "@/utils";
import { createPortal } from "react-dom";
import { ModuleBoundary } from "@/kernel";
import { MODAL_POSITIONS } from "./constants";
import {
  MODAL_CONTENT_VARIANTS,
  MODAL_FOOTER_VARIANTS,
  MODAL_HEADER_VARIANTS,
  MODAL_COMPOSITOR_STYLE,
  getModalPositionVariants,
  getModalTransition,
  modalBackdropVariants,
} from "./motion";
import {
  type ModalContainerFooterConfig,
  type ModalContainerHeaderConfig,
  type ModalContainerProps,
  type ModalThemeSlot,
  type ModalComponent,
  type ModalEntry,
} from "./types";
import {
  hasHeightConstraint,
  hasSlotContent,
  isHeaderConfig,
  isSidePosition,
  resolveHeaderActions,
  getModalLabel,
  getModalLayout,
  getModalPosition,
} from "./utils";
import {
  useModalContainerModel,
  useModalLayerModel,
  useModalModel,
} from "./hooks";
import { type ResolvedTheme } from "@/theme";

type Theme = ResolvedTheme<ModalThemeSlot>;

function CloseButton({
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

function SlotRow({
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

function resolveHeader(
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

  const left =
    customNode !== null
      ? null
      : (config.left ??
        (config.title ? (
          <h2 id={config.titleId} className={theme.slots.title}>
            {config.title}
          </h2>
        ) : null));
  const right =
    customNode !== null
      ? null
      : (config.right ??
        (hasSlotContent(actions) || showClose ? (
          <>
            {actions}
            {showClose && <CloseButton close={close} theme={theme} />}
          </>
        ) : null));

  return { center: customNode ?? config.center ?? null, config, left, right };
}

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
          variants={MODAL_HEADER_VARIANTS}
          left={headerRow.left}
          center={headerRow.center}
          right={headerRow.right}
          theme={theme}
          sticky={headerRow.config.sticky ? "top" : undefined}
        />
      )}

      <motion.div
        variants={MODAL_CONTENT_VARIANTS}
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
          variants={MODAL_FOOTER_VARIANTS}
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

function ModalLayer({
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
    baseZIndex,
  } = useModalLayerModel({
    closeModal,
    entry,
    isMobileViewport,
    isTopModal,
    modalStack,
    registry,
    stackIndex,
  });
  if (!ActiveModalComponent) return null;
  const layout = getModalLayout(activePosition, isMobileViewport);
  return (
    <div
      role="dialog"
      aria-modal={isTopModal}
      aria-labelledby={entry.title ? `modal-title-${entry.id}` : undefined}
      style={{ zIndex: baseZIndex }}
      data-position={getModalPosition(activePosition)}
      data-inset={
        activePosition === MODAL_POSITIONS.CENTER && !isMobileViewport
          ? true
          : undefined
      }
      className={theme.slots.layer}
    >
      <motion.div
        ref={modalRef}
        variants={getModalPositionVariants(activePosition)}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={getModalTransition(activePosition)}
        data-active={isTopModal}
        data-layout={layout}
        className={theme.slots.frame}
        style={{ zIndex: Z_INDEX.MODAL_FRAME, ...MODAL_COMPOSITOR_STYLE }}
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

export function Modal() {
  const {
    modalStack,
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
  if (!mounted) return null;
  return createPortal(
    <>
      <AnimatePresence>
        {isModalVisible && (
          <motion.div
            key="global-modal-backdrop"
            variants={modalBackdropVariants}
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
