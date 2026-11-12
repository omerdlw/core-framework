"use client";

import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";

import { useModalModel } from "../hooks";
import { useModalMotion } from "../motion";
import { type ModalEntry } from "../types";
import { ModalLayer } from "./modal-layer";

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
