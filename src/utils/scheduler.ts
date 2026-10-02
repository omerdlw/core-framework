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

export interface ScheduledTaskSnapshot {
  readonly createdAt: number;
  readonly dueAt: number;
  readonly id: number;
  readonly kind: "timer" | "frame";
  readonly label: string;
}

export interface SchedulerSnapshot {
  readonly pendingCount: number;
  readonly tasks: readonly ScheduledTaskSnapshot[];
}

export type ScheduleHandle = ReturnType<typeof setTimeout> | number;

export interface CoreSchedulerOptions {
  cancelFrame?: (id: ScheduleHandle) => void;
  clearTimer?: (id: ScheduleHandle) => void;
  defaultLabel?: string;
  now?: () => number;
  requestFrame?: (cb: (time: number) => void) => ScheduleHandle;
  scheduleTimer?: (cb: () => void, delayMs?: number) => ScheduleHandle;
}

export function createScheduler({
  cancelFrame = typeof window !== "undefined" &&
  typeof window.cancelAnimationFrame === "function"
    ? (id: ScheduleHandle) => window.cancelAnimationFrame(id as number)
    : (id: ScheduleHandle) => clearTimeout(id),
  clearTimer = (id: ScheduleHandle) => clearTimeout(id),
  defaultLabel = "scheduled-task",
  now = getDefaultSchedulerNow,
  requestFrame = typeof window !== "undefined" &&
  typeof window.requestAnimationFrame === "function"
    ? (cb: FrameRequestCallback) => window.requestAnimationFrame(cb)
    : (cb: FrameRequestCallback) =>
        setTimeout(cb, DEFAULT_SCHEDULER_FRAME_MS) as unknown as number,
  scheduleTimer = (cb: () => void, delayMs?: number) => setTimeout(cb, delayMs),
}: CoreSchedulerOptions = {}) {
  const listeners = new Set<() => void>();
  const tasks = new Map<
    number,
    {
      cancel: (id: ScheduleHandle) => void;
      createdAt: number;
      dueAt: number;
      id: number;
      kind: "timer" | "frame";
      label: string;
      nativeId: ScheduleHandle;
    }
  >();
  let nextTaskId = 0;
  let snapshot: SchedulerSnapshot = {
    pendingCount: 0,
    tasks: EMPTY_SCHEDULER_TASKS,
  };

  const publish = () => {
    const currentTasks: ScheduledTaskSnapshot[] = [];
    for (const task of tasks.values()) {
      currentTasks.push({
        createdAt: task.createdAt,
        dueAt: task.dueAt,
        id: task.id,
        kind: task.kind,
        label: task.label,
      });
    }

    snapshot = {
      pendingCount: tasks.size,
      tasks: currentTasks,
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
    kind: "timer" | "frame",
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
    try {
      task.cancel(task.nativeId);
    } catch (error) {
      report("Scheduler cancellation", error, "warn");
    }

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
        try {
          task.cancel(task.nativeId);
        } catch (error) {
          report("Scheduler cancellation", error, "warn");
        }
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
