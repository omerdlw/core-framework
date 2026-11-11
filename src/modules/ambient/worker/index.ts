import { extractHere, type AmbientExtractRequest } from "../pipeline";

export const AMBIENT_WORKER_REQUEST = "ambient:extract";
export const AMBIENT_WORKER_RESPONSE = "ambient:palette";

export interface AmbientWorkerRequest extends AmbientExtractRequest {
  id: number;
  type: typeof AMBIENT_WORKER_REQUEST;
}

export interface AmbientWorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
  postMessage(message: unknown): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
}

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
    scope.postMessage({
      ...result,
      id: request.id,
      type: AMBIENT_WORKER_RESPONSE,
    });
  };
  scope.addEventListener("message", onMessage);
  return () => scope.removeEventListener("message", onMessage);
}
