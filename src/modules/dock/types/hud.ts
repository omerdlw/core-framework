import type { ReactNode } from "react";

import type { DockComponent, DockComponentProps } from "./card";
import type { DockIconSource } from "./media";

/** An action button shown inside a HUD. */
export interface DockHudAction {
  label: string;
  onClick: () => void;
  tone?: "primary" | "destructive" | "secondary";
  variant?: "primary" | "destructive" | "muted";
}

/** A normalized HUD: content or component, priority and dismissal rules. */
export interface DockHudDescriptor {
  actions?: DockHudAction[];
  autoDismissMs?: number | null;
  component?: DockComponent | null;
  content?: ReactNode;
  description?: string;
  dismissOnEscape?: boolean;
  dismissOnNavigate?: boolean;
  element?: ReactNode;
  icon?: DockIconSource;
  id: string;
  isActive?: boolean;
  node?: ReactNode;
  onCancel?: (() => void) | null;
  onDismiss?: (() => void) | null;
  priority?: number;
  props?: DockComponentProps;
  renderMode?: string;
  title?: string;
}

/** Per-call overrides merged into a HUD definition. */
export type DockHudOverrides = Partial<DockHudDescriptor>;

/** Handle returned by `defineHud` for a HUD with typed props. */
export interface DockHudHandle {
  dismiss: (clearHudFn: (id?: string) => void) => void;
  id: string;
  update: (nextProps?: DockComponentProps) => void;
}

/** Function that shows a HUD from a handle. */
export interface DockHudTrigger {
  clear: (id?: string) => void;
  hide: (targetId?: string) => void;
  show: (
    props?: DockComponentProps,
    overrides?: DockHudOverrides,
  ) => DockHudHandle | null;
}

/** Handle for a HUD defined without fixed props. */
export interface GeneralHudHandle {
  clearHud: (id?: string) => void;
  setHud: (descriptor: DockHudDescriptor) => void;
}

/** Return value of `useHud`. */
export type UseHudReturn = DockHudTrigger | GeneralHudHandle;

/** API surface of a HUD handle: show, hide and hook-based use. */
export interface DockHudDefinition {
  config: Omit<DockHudDescriptor, "props"> & {
    defaultProps?: DockComponentProps;
  };
  create: (
    props?: DockComponentProps,
    overrides?: DockHudOverrides,
  ) => DockHudDescriptor;
  hide: (clearHudFn: (id?: string) => void, targetId?: string) => void;
  id: string;
  show: (
    setHudFn: (descriptor: DockHudDescriptor) => void,
    props?: DockComponentProps,
    overrides?: DockHudOverrides,
  ) => DockHudHandle;
  use: (props?: DockComponentProps, overrides?: DockHudOverrides) => void;
  useTrigger: () => DockHudTrigger;
}

/** HUD state for selection mode. */
export interface SelectionModeState {
  count: number;
  hasSelection: boolean;
  isActive: boolean;
  isAllSelected: boolean;
  selectedIds: (string | number)[];
}

/** HUD content attached to a long-running operation. */
export type DockOperationHud = DockHudDescriptor | DockComponent | ReactNode;

/** Loosely typed input accepted when starting an operation. */
export interface DockOperationInput {
  cancellable?: boolean;
  description?: string | null;
  hud?: DockOperationHud;
  icon?: DockIconSource;
  id?: string | number;
  label?: string;
  metadata?: Record<string, unknown> | null;
  onCancel?: ((result?: unknown) => unknown) | null;
  priority?: number;
  progress?: number | null;
  startedAt?: number;
}

/** A normalized long-running operation shown in the dock. */
export interface DockOperation {
  cancellable: boolean;
  description: string | null;
  endedAt?: number;
  hud: DockOperationHud;
  icon: DockIconSource;
  id: string;
  label: string;
  metadata: Record<string, unknown>;
  onCancel: ((result?: unknown) => unknown) | null;
  priority: number;
  progress: number | null;
  result?: unknown;
  startedAt: number;
  status: string;
}

/** Queue of operations tracked by the dock. */
export interface DockOperationState {
  entries: DockOperation[];
}

/** Action dispatched to the operation reducer. */
export interface DockOperationAction {
  endedAt?: number;
  id?: string | number | null;
  maxEntries?: number;
  operation?: DockOperation | null;
  patch?: Partial<DockOperationInput>;
  result?: unknown;
  type: string;
}

/** Operation controls: start, update, complete, cancel and clear. */
export interface DockOperationActions {
  cancel: (id: string | number, result?: unknown) => boolean;
  clear: (id?: string | number | null) => void;
  complete: (id: string | number, result?: unknown) => boolean;
  start: (input?: DockOperationInput) => DockOperation | null;
  update: (id: string | number, patch?: Partial<DockOperationInput>) => boolean;
}

/** Options for `defineHud`. */
export interface DefineHudOptions {
  autoDismissMs?: number | null;
  component?: DockComponent | null;
  defaultProps?: DockComponentProps;
  description?: string;
  dismissOnEscape?: boolean;
  dismissOnNavigate?: boolean;
  icon?: DockIconSource;
  id?: string;
  priority?: number;
  title?: string;
  [key: string]: unknown;
}
