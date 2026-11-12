import type { ReactNode } from "react";
import type { DockComponent, DockComponentProps } from "./card";
import type { DockIconSource } from "./media";

export interface DockHudAction {
  label: string;
  onClick: () => void;
  tone?: "primary" | "destructive" | "secondary";
  variant?: "primary" | "destructive" | "muted";
}

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

export type DockHudOverrides = Partial<DockHudDescriptor>;

export interface DockHudHandle {
  dismiss: (clearHudFn: (id?: string) => void) => void;
  id: string;
  update: (nextProps?: DockComponentProps) => void;
}

export interface DockHudTrigger {
  clear: (id?: string) => void;
  hide: (targetId?: string) => void;
  show: (
    props?: DockComponentProps,
    overrides?: DockHudOverrides,
  ) => DockHudHandle | null;
}

export interface GeneralHudHandle {
  clearHud: (id?: string) => void;
  setHud: (descriptor: DockHudDescriptor) => void;
}

export type UseHudReturn = DockHudTrigger | GeneralHudHandle;

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

export interface SelectionModeState {
  count: number;
  hasSelection: boolean;
  isActive: boolean;
  isAllSelected: boolean;
  selectedIds: (string | number)[];
}

export type DockOperationHud = DockHudDescriptor | DockComponent | ReactNode;

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

export interface DockOperationState {
  entries: DockOperation[];
}

export interface DockOperationAction {
  endedAt?: number;
  id?: string | number | null;
  maxEntries?: number;
  operation?: DockOperation | null;
  patch?: Partial<DockOperationInput>;
  result?: unknown;
  type: string;
}

export interface DockOperationActions {
  cancel: (id: string | number, result?: unknown) => boolean;
  clear: (id?: string | number | null) => void;
  complete: (id: string | number, result?: unknown) => boolean;
  start: (input?: DockOperationInput) => DockOperation | null;
  update: (id: string | number, patch?: Partial<DockOperationInput>) => boolean;
}

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
