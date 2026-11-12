"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useMemo, useRef } from "react";

import {
  defineModule,
  type PageConfig,
  type PageModuleApi,
} from "@/core/kernel";

import { ModalContext, ModalProvider } from "./context";
import { useModal, useModalActions } from "./hooks";
import { getModalIdentity } from "./model/identity";
import {
  type DefineModalOptions,
  type ModalDefinition,
  type ModalInput,
  type ModalPageApi,
  type ModalPageConfig,
} from "./types";

const LazyModal = dynamic(
  () => import("./components/overlay").then((view) => view.Modal),
  {
    ssr: false,
  },
);

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
  Overlay: LazyModal,
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
