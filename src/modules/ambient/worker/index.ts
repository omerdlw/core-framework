import { type AmbientExtractRequest, extractHere } from "../pipeline";

/**
 * Message type of an extraction request sent to the worker.
 */
export const AMBIENT_WORKER_REQUEST = "ambient:extract";
/**
 * Message type of the worker's reply.
 */
export const AMBIENT_WORKER_RESPONSE = "ambient:palette";

/**
 * An extraction request posted to the ambient worker.
 */
export interface AmbientWorkerRequest extends AmbientExtractRequest {
  id: number;
  type: typeof AMBIENT_WORKER_REQUEST;
}

/**
 * The part of a worker global scope that serveAmbientWorker uses.
 */
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

/**
 * Starts answering extraction requests in a worker. Returns a function that
 * stops it.
 */
export function serveAmbientWorker(
  scope: AmbientWorkerScope = globalThis,
): () => void {
  const respond = async (request: AmbientWorkerRequest) => {
    let result: Awaited<ReturnType<typeof extractHere>>;
    try {
      result = await extractHere(request);
    } catch {
      // A failed extraction is answered with an empty palette.
      result = { palette: null, supported: true };
    }
    scope.postMessage({
      ...result,
      id: request.id,
      type: AMBIENT_WORKER_RESPONSE,
    });
  };
  const onMessage = (event: MessageEvent) => {
    const request = event.data as AmbientWorkerRequest | null;
    if (request?.type !== AMBIENT_WORKER_REQUEST) return;
    void respond(request);
  };
  scope.addEventListener("message", onMessage);
  return () => scope.removeEventListener("message", onMessage);
}
