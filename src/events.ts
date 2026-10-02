import { report } from "./utils/report";
export type EventListener<T = unknown> = (payload: T) => void;

export const EVENT_TYPES = Object.freeze({
  API_UNAUTHORIZED: "API_UNAUTHORIZED",
  STATE_CHANGE: "STATE_CHANGE",
  API_ERROR: "API_ERROR",
  APP_ERROR: "APP_ERROR",
} as const);

export interface FrameworkEventMap {
  [EVENT_TYPES.API_UNAUTHORIZED]: {
    error?: unknown;
    status?: number;
    [key: string]: unknown;
  };
  [EVENT_TYPES.API_ERROR]: {
    error: unknown;
    isCritical?: boolean;
    message?: string;
    retry?: () => void;
    status?: number;
    [key: string]: unknown;
  };
  [EVENT_TYPES.APP_ERROR]: {
    error?: unknown;
    message?: string;
    resetError?: () => void;
    source?: string;
    [key: string]: unknown;
  };
  [EVENT_TYPES.STATE_CHANGE]: {
    message?: string;
    status?: "success" | "warning" | "info" | "error" | string;
    [key: string]: unknown;
  };
}

export class EventEmitter<TEvents extends object = FrameworkEventMap> {
  private events: Map<string, Set<EventListener<never>>> = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();

  subscribe<K extends keyof TEvents>(
    event: K,
    callback: EventListener<TEvents[K]>,
  ): () => void;
  subscribe<T = unknown>(event: string, callback: EventListener<T>): () => void;
  subscribe(event: string, callback: EventListener<never>): () => void {
    if (typeof event !== "string" || !event || typeof callback !== "function") {
      return () => {};
    }
    const listeners = this.events.get(event) || new Set<EventListener<never>>();
    listeners.add(callback);
    this.events.set(event, listeners);

    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) this.events.delete(event);
    };
  }

  emit<K extends keyof TEvents>(
    event: K,
    ...args: TEvents[K] extends void | undefined
      ? [payload?: TEvents[K]]
      : [payload: TEvents[K]]
  ): void;
  emit<T = unknown>(event: string, payload?: T): void;
  emit(event: string, payload?: unknown): void {
    const listeners = this.events.get(event);
    if (!listeners || listeners.size === 0) return;
    const snapshot = Array.from(listeners);
    for (const callback of snapshot) {
      try {
        (callback as EventListener<unknown>)(payload);
      } catch (error) {
        report(`Event listener (${String(event)})`, error);
      }
    }
  }

  emitDebounced<K extends keyof TEvents>(
    event: K,
    payload: TEvents[K],
    waitMs?: number,
  ): void;
  emitDebounced<T = unknown>(event: string, payload?: T, waitMs?: number): void;
  emitDebounced(event: string, payload?: unknown, waitMs: number = 100): void {
    const existing = this.debounceTimers.get(event);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(event);
      this.emit(event, payload);
    }, waitMs);

    this.debounceTimers.set(event, timer);
  }

  cancelDebounced(event?: string): void {
    if (event) {
      const timer = this.debounceTimers.get(event);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(event);
      }
    } else {
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();
    }
  }

  unsubscribeAll(event?: string): void {
    this.cancelDebounced(event);
    if (event) this.events.delete(event);
    else this.events.clear();
  }

  hasListeners(event: string): boolean {
    return Boolean(this.events.get(event)?.size);
  }

  getListenerCount(event: string): number {
    return this.events.get(event)?.size || 0;
  }

  getAllEvents(): string[] {
    return [...this.events.keys()];
  }
}

const GLOBAL_EVENTS_KEY = Symbol.for("__base_framework_global_events__");
type GlobalWithEvents = typeof globalThis & {
  [GLOBAL_EVENTS_KEY]?: EventEmitter<FrameworkEventMap>;
};

const _global = globalThis as GlobalWithEvents;
export const globalEvents: EventEmitter<FrameworkEventMap> =
  _global[GLOBAL_EVENTS_KEY] ??
  (_global[GLOBAL_EVENTS_KEY] = new EventEmitter<FrameworkEventMap>());
