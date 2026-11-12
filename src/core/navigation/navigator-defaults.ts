import { globalEvents } from "@/foundation/events";

const NO_DELAY_MS = 0;

export type Timer = ReturnType<typeof setTimeout>;

export const emitGlobal = (event: string, payload: Record<string, unknown>) =>
  globalEvents.emit(event, payload);

export const afterPaint = (callback: () => void) => {
  if (typeof requestAnimationFrame === "function")
    requestAnimationFrame(() => callback());
  else setTimeout(callback, NO_DELAY_MS);
};
