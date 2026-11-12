import { report } from "./report";
const DEFAULT_SCHEDULER_FRAME_MS = 16;

const EMPTY_SCHEDULER_TASKS: readonly ScheduledTaskSnapshot[] = Object.freeze(
  [],
);

function getDefaultSchedulerNow(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

type ScheduledTaskKind = "timer" | "frame";

/**
 * A read-only view of one pending scheduler task.
 */
export interface ScheduledTaskSnapshot {
  readonly createdAt: number;
  readonly dueAt: number;
  readonly id: number;
  readonly kind: ScheduledTaskKind;
  readonly label: string;
}

/**
 * A read-only view of all pending scheduler tasks.
 */
export interface SchedulerSnapshot {
  readonly pendingCount: number;
  readonly tasks: readonly ScheduledTaskSnapshot[];
}

/**
 * The native handle returned by a timer or animation frame request.
 */
export type ScheduleHandle = ReturnType<typeof setTimeout> | number;

/**
 * Overrides for timers, frames and the clock, mainly for tests and non-DOM hosts.
 */
export interface CoreSchedulerOptions {
  cancelFrame?: (id: ScheduleHandle) => void;
  clearTimer?: (id: ScheduleHandle) => void;
  defaultLabel?: string;
  now?: () => number;
  requestFrame?: (cb: (time: number) => void) => ScheduleHandle;
  scheduleTimer?: (cb: () => void, delayMs?: number) => ScheduleHandle;
}

interface TaskRecord {
  cancel: (id: ScheduleHandle) => void;
  createdAt: number;
  dueAt: number;
  id: number;
  kind: ScheduledTaskKind;
  label: string;
  nativeId: ScheduleHandle;
}

const DEFAULT_TASK_LABEL = "scheduled-task";

function createDefaultCancelFrame(): (id: ScheduleHandle) => void {
  return typeof window !== "undefined" &&
    typeof window.cancelAnimationFrame === "function"
    ? (id) => window.cancelAnimationFrame(id as number)
    : (id) => clearTimeout(id);
}

function createDefaultRequestFrame(): (
  cb: (time: number) => void,
) => ScheduleHandle {
  return typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function"
    ? (cb) => window.requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, DEFAULT_SCHEDULER_FRAME_MS);
}

function toTaskSnapshot(task: TaskRecord): ScheduledTaskSnapshot {
  return {
    createdAt: task.createdAt,
    dueAt: task.dueAt,
    id: task.id,
    kind: task.kind,
    label: task.label,
  };
}

/** Cancels the native handle; a throwing canceller is reported, not rethrown. */
function cancelNative(task: TaskRecord): void {
  try {
    task.cancel(task.nativeId);
  } catch (error) {
    report("Scheduler cancellation", error, "warn");
  }
}

/**
 * Creates a scheduler that tracks timers and animation frames so they can be
 * inspected, subscribed to and cancelled together.
 */
export function createScheduler({
  cancelFrame = createDefaultCancelFrame(),
  clearTimer = (id: ScheduleHandle) => clearTimeout(id),
  defaultLabel = DEFAULT_TASK_LABEL,
  now = getDefaultSchedulerNow,
  requestFrame = createDefaultRequestFrame(),
  scheduleTimer = (cb: () => void, delayMs?: number) => setTimeout(cb, delayMs),
}: CoreSchedulerOptions = {}) {
  const listeners = new Set<() => void>();
  const tasks = new Map<number, TaskRecord>();
  let nextTaskId = 0;
  let snapshot: SchedulerSnapshot = {
    pendingCount: 0,
    tasks: EMPTY_SCHEDULER_TASKS,
  };

  const publish = () => {
    snapshot = {
      pendingCount: tasks.size,
      tasks: Array.from(tasks.values(), toTaskSnapshot),
    };

    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        report("Scheduler subscriber", error, "warn");
      }
    }
  };

  const scheduleInternal = (
    kind: ScheduledTaskKind,
    callback: (timestamp: number) => void,
    delayMs: number,
    options: { label?: string } = {},
  ): number | null => {
    if (typeof callback !== "function") return null;

    const safeDelay = Math.max(0, Number(delayMs) || 0);
    const taskId = ++nextTaskId;
    const createdAt = now();

    const invoke = (timestamp = now()) => {
      if (!tasks.has(taskId)) return;
      tasks.delete(taskId);
      publish();
      callback(timestamp);
    };

    const nativeId =
      kind === "frame"
        ? requestFrame(invoke)
        : scheduleTimer(invoke, safeDelay);

    tasks.set(taskId, {
      cancel: kind === "frame" ? cancelFrame : clearTimer,
      createdAt,
      dueAt:
        createdAt + (kind === "frame" ? DEFAULT_SCHEDULER_FRAME_MS : safeDelay),
      id: taskId,
      kind,
      label:
        typeof options.label === "string" && options.label
          ? options.label
          : defaultLabel,
      nativeId,
    });

    publish();
    return taskId;
  };

  const cancel = (taskId: number): boolean => {
    const task = tasks.get(taskId);
    if (!task) return false;

    tasks.delete(taskId);
    cancelNative(task);

    publish();
    return true;
  };

  return Object.freeze({
    cancel,
    cancelAll(): number[] {
      if (tasks.size === 0) return [];

      const taskIds: number[] = [];
      for (const [taskId, task] of tasks) {
        taskIds.push(taskId);
        cancelNative(task);
      }

      tasks.clear();
      publish();
      return taskIds;
    },
    getSnapshot(): SchedulerSnapshot {
      return snapshot;
    },
    now,
    schedule(
      callback: (timestamp: number) => void,
      delayMs = 0,
      options: { label?: string } = {},
    ): number | null {
      return scheduleInternal("timer", callback, delayMs, options);
    },
    scheduleFrame(
      callback: (timestamp: number) => void,
      options: { label?: string } = {},
    ): number | null {
      return scheduleInternal(
        "frame",
        callback,
        DEFAULT_SCHEDULER_FRAME_MS,
        options,
      );
    },
    subscribe(listener: () => void): () => void {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
