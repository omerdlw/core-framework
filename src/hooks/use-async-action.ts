"use client";

import { useCallback, useState } from "react";
import { EVENT_TYPES, globalEvents } from "@/events";
import { isErr, isResult } from "@/result";
import { toUserMessage } from "@/utils";
import { UseAsyncActionOptions, UseAsyncActionResult } from "./types";

export function useAsyncAction<
  TArgs extends unknown[] = unknown[],
  TResult = unknown,
>(
  actionFn: (...args: TArgs) => Promise<TResult>,
  options: UseAsyncActionOptions<TResult> = {},
): UseAsyncActionResult<TArgs, TResult> {
  const {
    errorMessage = null,
    onError = null,
    onSuccess = null,
    successMessage = null,
    toast = null,
  } = options;

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setIsPending(true);
      setError(null);
      try {
        const result = await actionFn(...args);

        if (isResult(result) && isErr(result)) {
          setError(result.error);
          const resolvedMessage = errorMessage || toUserMessage(result.error);
          if (typeof toast === "function") {
            toast(resolvedMessage);
          }
          globalEvents.emit(EVENT_TYPES.APP_ERROR, {
            error: result.error,
            message: resolvedMessage,
            notify: toast === true,
          });
          await onError?.(result.error);
          return result;
        }

        if (successMessage) {
          if (typeof toast === "function") {
            toast(successMessage);
          }
          globalEvents.emit(EVENT_TYPES.STATE_CHANGE, {
            message: successMessage,
            notify: toast === true,
            status: "success",
          });
        }
        await onSuccess?.(result);
        return result;
      } catch (err) {
        setError(err);
        const resolvedMessage = errorMessage || toUserMessage(err);
        if (typeof toast === "function") {
          toast(resolvedMessage);
        }
        globalEvents.emit(EVENT_TYPES.APP_ERROR, {
          error: err,
          message: resolvedMessage,
          notify: toast === true,
        });
        await onError?.(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [actionFn, errorMessage, onError, onSuccess, successMessage, toast],
  );

  return { error, execute, isPending };
}
