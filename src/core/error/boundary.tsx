"use client";

import { usePathname } from "next/navigation";
import React, { type ErrorInfo, type ReactNode } from "react";

import { EVENT_TYPES, globalEvents } from "@/foundation/events";
import { report, toUserMessage } from "@/foundation/utils";
import { useTheme } from "@/react/theme";
import { Button } from "@/react/ui/components/button";
import { Icon } from "@/react/ui/components/icon";

import { ERROR_MESSAGES } from "./constants";
import { getErrorReporter } from "./reporter";
import { errorTheme } from "./theme";
import type {
  ComponentErrorProps,
  ErrorBoundaryCoreProps,
  ErrorBoundaryCoreState,
  GlobalErrorProps,
  ModuleErrorProps,
} from "./types";
import { createErrorContext } from "./utils";

const ERROR_ICON = "solar:danger-circle-bold";
const ERROR_ICON_SIZE = 30;
const RETRY_LABEL = "Try again";

// Button's own prop types do not expose the plain button props used here.
const ActionButton = Button as React.ComponentType<{
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}>;

interface DefaultErrorFallbackProps {
  error: Error | null;
  message?: string;
  resetError: () => void;
  title?: string;
}

function DefaultErrorFallback({
  error,
  message,
  resetError,
}: DefaultErrorFallbackProps) {
  const theme = useTheme(errorTheme);

  return (
    <div className={theme.slots.screen}>
      <div className={theme.slots.icon}>
        <Icon icon={ERROR_ICON} size={ERROR_ICON_SIZE} />
      </div>
      <h3 className={theme.slots.title}>
        {message ||
          toUserMessage(error, { fallback: ERROR_MESSAGES.FALLBACK_MSG })}
      </h3>
      <ActionButton
        className={theme.slots.retryButton}
        onClick={resetError}
        type="button"
      >
        {RETRY_LABEL}
      </ActionButton>
    </div>
  );
}

/**
 * Base React error boundary: catches render errors, reports them, and renders a
 * fallback until reset.
 */
export class ErrorBoundaryCore extends React.Component<
  ErrorBoundaryCoreProps,
  ErrorBoundaryCoreState
> {
  constructor(props: ErrorBoundaryCoreProps) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
      hasError: false,
      lastResetKey: props.resetKey,
    };
  }

  static getDerivedStateFromError(
    error: Error,
  ): Partial<ErrorBoundaryCoreState> {
    return { error, hasError: true };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryCoreProps,
    state: ErrorBoundaryCoreState,
  ): Partial<ErrorBoundaryCoreState> | null {
    if (props.resetKey !== state.lastResetKey) {
      return {
        error: null,
        errorInfo: null,
        hasError: false,
        lastResetKey: props.resetKey,
      };
    }
    return null;
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    const { message, name, onError, silent, title, variant } = this.props;
    const context = createErrorContext({ errorInfo, name, title, variant });

    try {
      onError?.(error, errorInfo, context);
    } catch (callbackError) {
      report("ErrorBoundary onError callback", callbackError, "warn");
    }

    if (!silent) {
      globalEvents.emit(EVENT_TYPES.APP_ERROR, {
        error,
        errorInfo,
        message: message || toUserMessage(error),
        resetError: this.resetError,
      });
    }

    try {
      const reporter = getErrorReporter();
      reporter?.captureError?.(error, context);
    } catch (reportingError) {
      report("ErrorBoundary reporting", reportingError, "warn");
    }
  }

  resetError = () => {
    this.setState({
      error: null,
      errorInfo: null,
      hasError: false,
    });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const { fallback, message, title } = this.props;
    const { error } = this.state;

    if (typeof fallback === "function") {
      return fallback({ error, resetError: this.resetError });
    }

    if (fallback) {
      return fallback;
    }

    return (
      <DefaultErrorFallback
        error={error}
        message={message}
        resetError={this.resetError}
        title={title}
      />
    );
  }
}

/**
 * Application-wide error boundary that resets when the route changes.
 */
export function GlobalError({ children, fallback, onReset }: GlobalErrorProps) {
  const pathname = usePathname();

  return (
    <ErrorBoundaryCore
      fallback={fallback}
      message={ERROR_MESSAGES.GLOBAL_MSG}
      onReset={onReset}
      resetKey={pathname}
      title={ERROR_MESSAGES.GLOBAL_TITLE}
      variant="full"
    >
      {children}
    </ErrorBoundaryCore>
  );
}

/**
 * Error boundary scoped to a single module, labelled with its name.
 */
export function ModuleError({
  children,
  fallback,
  name,
  onReset,
}: ModuleErrorProps) {
  return (
    <ErrorBoundaryCore
      fallback={fallback}
      message={ERROR_MESSAGES.MODULE_MSG}
      name={name}
      onReset={onReset}
      title={name ? `${name} Error` : ERROR_MESSAGES.MODULE_TITLE}
      variant="module"
    >
      {children}
    </ErrorBoundaryCore>
  );
}

/**
 * Inline error boundary for a single component or section.
 */
export function ComponentError({
  children,
  fallback,
  message,
  onReset,
}: ComponentErrorProps) {
  return (
    <ErrorBoundaryCore
      fallback={fallback}
      message={message || ERROR_MESSAGES.COMPONENT_MSG}
      onReset={onReset}
      variant="inline"
    >
      {children}
    </ErrorBoundaryCore>
  );
}
