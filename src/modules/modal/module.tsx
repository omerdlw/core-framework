"use client";

import {
  lazy,
  Suspense,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  defineModule,
  type PageConfig,
  type PageModuleApi,
} from "@/core/kernel";
import { createStore } from "@/foundation/utils";
import { useStore } from "@/react/hooks";

import type * as OverlayView from "./components/overlay";
import { ModalContext, ModalProvider } from "./context";
import { useModal, useModalActions } from "./hooks";
import { getModalIdentity } from "./model/identity";
import { INITIAL_MODAL_STATE } from "./model/state";
import {
  type DefineModalOptions,
  type ModalDefinition,
  type ModalInput,
  type ModalPageApi,
  type ModalPageConfig,
  type ModalState,
} from "./types";

let overlayChunk: Promise<typeof OverlayView> | null = null;
const loadOverlay = () => (overlayChunk ??= import("./components/overlay"));

const LazyModal = lazy(() =>
  loadOverlay().then((view) => ({ default: view.Modal })),
);

const IDLE_STORE = createStore<ModalState>(INITIAL_MODAL_STATE, {
  freezeSnapshots: false,
});

const IDLE_PRELOAD_FALLBACK_MS = 2000;

/** Warms the overlay chunk once the page is idle, off the hydration path. */
function preloadWhenIdle(): () => void {
  const preload = () => void loadOverlay();
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(preload);
    return () => window.cancelIdleCallback(handle);
  }
  const timer = setTimeout(preload, IDLE_PRELOAD_FALLBACK_MS);
  return () => clearTimeout(timer);
}

const hasOpenModal = (state: ModalState) => state.isOpen;

/**
 * Mounts the modal overlay the first time a modal opens and keeps it mounted
 * afterwards (exit animations need it). Until then no overlay code runs: no
 * viewport listeners, registry subscription or portal, and its chunk loads
 * on idle instead of during hydration.
 */
function ModalOverlay() {
  const modal = use(ModalContext);
  const isOpen = useStore(modal?.store ?? IDLE_STORE, hasOpenModal);
  const [needed, setNeeded] = useState(false);
  if (isOpen && !needed) setNeeded(true);

  useEffect(() => (modal ? preloadWhenIdle() : undefined), [modal]);

  if (!needed) return null;
  return (
    <Suspense fallback={null}>
      <LazyModal />
    </Suspense>
  );
}

function selectPageModals(config: PageConfig): ModalPageConfig | null {
  return config.modal ?? null;
}

function useModalPage(
  slice: ModalPageConfig | null,
  page: PageModuleApi,
): ModalPageApi {
  const actions = useModalActions();
  const sliceRef = useRef(slice);
  useLayoutEffect(() => {
    sliceRef.current = slice;
  }, [slice]);

  // stable identity: part of the public hook contract
  return useMemo(
    () => ({
      ...actions,
      open: (modal: ModalInput, data: Record<string, unknown> = {}) => {
        const own =
          typeof modal === "string" && modal !== "registry"
            ? sliceRef.current?.[modal]
            : undefined;
        return actions.openModal((own as ModalInput) ?? modal, { data });
      },
      set: (modal: ModalPageConfig) => page.set({ modal }),
    }),
    [actions, page],
  );
}

/**
 * The modal module definition: install it on the framework to render a modal stack
 * and let pages register modals through `page.modal`.
 */
export const modalModule = defineModule({
  id: "modal",
  context: ModalContext,
  Provider: ModalProvider,
  Overlay: ModalOverlay,
  registry: {
    cleanupDelayMs: 600,
    keyPolicy: "named",
    lifecycle: "immediate",
    valueKind: "component",
  },
  page: {
    select: selectPageModals,
    entries: (slice: ModalPageConfig) =>
      Object.entries(slice).map(([key, value]) => ({ key, value })),
    use: useModalPage,
  },
});

declare module "@omerdlw/base-framework/kernel" {
  interface CoreModules {
    modal: typeof modalModule;
  }
  interface PageConfig {
    modal?: ModalPageConfig;
  }
}

/**
 * Defines a reusable modal. Its `use` hook returns the `[open, controls]` binding.
 */
export function defineModal(
  definition: DefineModalOptions = {},
): ModalDefinition {
  const { type } = getModalIdentity(definition);

  const modalDefinition: ModalDefinition = Object.freeze({
    ...definition,
    id: definition.id || type,
    isModalDefinition: true,
    type,
    use: function useDefinedModal() {
      return useModal(modalDefinition);
    },
  });
  return modalDefinition;
}
