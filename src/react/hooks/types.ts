/**
 * Options for `useGlobalEvent`: debounce or throttle the handler.
 */
export interface UseGlobalEventOptions {
  debounceMs?: number;
  throttleMs?: number;
}

/**
 * Options for `useControllableState`: a default, an optional controlled value and a change callback.
 */
export interface UseControllableStateOptions<T> {
  defaultValue: T;
  onChange?: (nextValue: T) => void;
  value?: T;
}

/**
 * Options for `useHotkey`: whether it is active, whether it fires in form fields, and event handling.
 */
export interface UseHotkeyOptions {
  enabled?: boolean;
  enableOnFormTags?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}
