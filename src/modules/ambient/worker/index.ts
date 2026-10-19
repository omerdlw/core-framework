import { extractHere, type AmbientExtractRequest } from "../pipeline";

// `@omerdlw/base-framework/ambient/worker`: runs extraction off the main thread.
//
//   // ambient.worker.ts (in the app)
//   import { serveAmbientWorker } from "@omerdlw/base-framework/ambient/worker";
//   serveAmbientWorker();
//
//   // once, on the client
//   configureAmbient({
//     worker: () =>
//       new Worker(new URL("./ambient.worker.ts", import.meta.url), { type: "module" }),
//   });

export const AMBIENT_WORKER_REQUEST = "ambient:extract";
export const AMBIENT_WORKER_RESPONSE = "ambient:palette";

export interface AmbientWorkerRequest extends AmbientExtractRequest {
  id: number;
  type: typeof AMBIENT_WORKER_REQUEST;
}

export interface AmbientWorkerScope {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  postMessage(message: unknown): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
}

/** Answers extraction requests in a worker. Returns a function that stops it. */
export function serveAmbientWorker(
  scope: AmbientWorkerScope = globalThis as unknown as AmbientWorkerScope,
): () => void {
  const onMessage = async (event: MessageEvent) => {
    const request = event.data as AmbientWorkerRequest | null;
    if (request?.type !== AMBIENT_WORKER_REQUEST) return;
    let result: Awaited<ReturnType<typeof extractHere>>;
    try {
      result = await extractHere(request);
    } catch {
      result = { palette: null, supported: true };
    }
    scope.postMessage({ ...result, id: request.id, type: AMBIENT_WORKER_RESPONSE });
  };
  scope.addEventListener("message", onMessage);
  return () => scope.removeEventListener("message", onMessage);
}
