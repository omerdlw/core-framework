import { type ReactNode } from "react";

import { type Theme } from "../lib/theme";
import {
  hasSlotContent,
  isHeaderConfig,
  resolveHeaderActions,
} from "../model/header";
import {
  type ModalContainerHeaderConfig,
  type ModalContainerProps,
} from "../types";
import { CloseButton } from "./close-button";

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
