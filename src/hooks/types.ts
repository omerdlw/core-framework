import { Result } from "../result";

export type ActionToastOption = boolean | ((msg: string) => void) | null;

export interface UseAsyncActionOptions<TResult = unknown> {
  errorMessage?: string | null;
  onError?: ((err: unknown) => void | Promise<void>) | null;
  onSuccess?: ((result: TResult) => void | Promise<void>) | null;
  successMessage?: string | null;
  toast?: ActionToastOption;
}

export interface UseAsyncActionResult<TArgs extends unknown[], TResult> {
  error: unknown;
  execute: (...args: TArgs) => Promise<TResult>;
  isPending: boolean;
}

export interface UseControllableStateOptions<T> {
  defaultValue: T;
  onChange?: (nextValue: T) => void;
  value?: T;
}

export interface UseGlobalEventOptions {
  debounceMs?: number;
  throttleMs?: number;
}

export interface UseHotkeyOptions {
  enabled?: boolean;
  enableOnFormTags?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

export interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  enabled?: boolean;
  freezeOnceVisible?: boolean;
  onChange?: (entry: IntersectionObserverEntry) => void;
}

export interface UseIntersectionObserverResult {
  entry: IntersectionObserverEntry | null;
  isIntersecting: boolean;
}

export interface UseServerActionOptions<T, E = string> {
  errorMessage?: string | null;
  onError?: ((err: E) => void | Promise<void>) | null;
  onSuccess?: ((data: T) => void | Promise<void>) | null;
  successMessage?: string | null;
  toast?: ActionToastOption;
}

export interface UseServerActionResult<TArgs extends unknown[], T, E = string> {
  data: T | null;
  error: E | null;
  execute: (...args: TArgs) => Promise<Result<T, E>>;
  isPending: boolean;
  reset: () => void;
}

export interface UseStorageStateOptions<T> {
  deserialize?: (raw: string) => T;
  serialize?: (value: T) => string;
  storage?: "local" | "session";
}
