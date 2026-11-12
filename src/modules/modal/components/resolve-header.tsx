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
