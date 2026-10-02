"use client";

import { useCallback, useState, useTransition } from "react";
import { EVENT_TYPES, globalEvents } from "@/events";
import { err as resultErr, isErr, type Result } from "@/result";
import { toUserMessage } from "@/utils";
import { UseServerActionOptions, UseServerActionResult } from "./types";

export function useServerAction<
  TArgs extends unknown[] = unknown[],
  T = unknown,
  E = string,
>(
  actionFn: (...args: TArgs) => Promise<Result<T, E>>,
  options: UseServerActionOptions<T, E> = {},
): UseServerActionResult<TArgs, T, E> {
  const {
    errorMessage = null,
    onError = null,
    onSuccess = null,
    successMessage = null,
    toast = null,
  } = options;

  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<E | null>(null);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  const execute = useCallback(
    (...args: TArgs): Promise<Result<T, E>> => {
      return new Promise((resolve) => {
        startTransition(async () => {
          setError(null);
          try {
            const result = await actionFn(...args);
            if (isErr(result)) {
              setError(result.error);
              const resolvedMessage =
                errorMessage || toUserMessage(result.error);
              if (typeof toast === "function") {
                toast(resolvedMessage);
              }
              globalEvents.emit(EVENT_TYPES.APP_ERROR, {
                error: result.error,
                message: resolvedMessage,
                notify: toast === true,
              });
              await onError?.(result.error);
              resolve(result);
              return;
            }

            setData(result.data);
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
            await onSuccess?.(result.data);
            resolve(result);
          } catch (err) {
            const mappedError = toUserMessage(err) as unknown as E;
            setError(mappedError);
            const resolvedMessage = errorMessage || (mappedError as string);
            if (typeof toast === "function") {
              toast(resolvedMessage);
            }
            globalEvents.emit(EVENT_TYPES.APP_ERROR, {
              error: err,
              message: resolvedMessage,
              notify: toast === true,
            });
            await onError?.(mappedError);
            resolve(resultErr(mappedError));
          }
        });
      });
    },
    [actionFn, errorMessage, onError, onSuccess, successMessage, toast],
  );

  return { data, error, execute, isPending, reset };
}
