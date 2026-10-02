"use client";

import { useInsertionEffect, useMemo, useRef } from "react";
import {
  defineModule,
  type PageConfig,
  type PageModuleApi,
} from "@/kernel";
import dynamic from "next/dynamic";
import {
  ModalContext,
  ModalProvider,
  useModal,
  useModalActions,
} from "./context";
import {
  type DefineModalOptions,
  type ModalDefinition,
  type ModalInput,
  type ModalPageApi,
  type ModalPageConfig,
} from "./types";
import { getModalIdentity } from "./utils";

const LazyModal = dynamic(
  () => import("./overlay").then((view) => view.Modal),
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
  useInsertionEffect(() => {
    sliceRef.current = slice;
  }, [slice]);

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

declare module "@/kernel" {
  interface CoreModules {
    modal: typeof modalModule;
  }
  interface PageConfig {
    modal?: ModalPageConfig;
  }
}

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
