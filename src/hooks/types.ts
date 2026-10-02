export interface UseGlobalEventOptions {
  debounceMs?: number;
  throttleMs?: number;
}

export interface UseControllableStateOptions<T> {
  defaultValue: T;
  onChange?: (nextValue: T) => void;
  value?: T;
}

export interface UseHotkeyOptions {
  enabled?: boolean;
  enableOnFormTags?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

