import {
  cloneElement,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type Ref,
} from "react";

export interface TriggerProps {
  "aria-describedby"?: string;
  "data-state"?: string;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  ref?: Ref<HTMLElement>;
}

type TriggerHandler = Exclude<
  keyof TriggerProps,
  "aria-describedby" | "data-state" | "ref"
>;

const TRIGGER_HANDLERS: readonly TriggerHandler[] = [
  "onBlur",
  "onClick",
  "onFocus",
  "onPointerDown",
  "onPointerLeave",
  "onPointerMove",
];

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

type EventHandler = (event: { defaultPrevented: boolean }) => void;

interface SlotProps extends TriggerProps {
  children: ReactElement<TriggerProps>;
  forwardRef?: Ref<HTMLElement>;
}

/**
 * Merges the trigger behaviour into the child element without a wrapper. The
 * child's own handler runs first; ours is skipped if it prevented default.
 */
export function Slot({ children, forwardRef, ref, ...ours }: SlotProps) {
  const theirs = children.props;
  const merged: TriggerProps = {
    "aria-describedby": ours["aria-describedby"] ?? theirs["aria-describedby"],
    "data-state": ours["data-state"],
    ref: (node: HTMLElement | null) => {
      assignRef(ref, node);
      assignRef(theirs.ref, node);
      assignRef(forwardRef, node);
    },
  };
  for (const name of TRIGGER_HANDLERS) {
    const own = theirs[name] as EventHandler | undefined;
    const added = ours[name] as EventHandler | undefined;
    if (!added) continue;
    (merged as Record<string, EventHandler>)[name] = (event) => {
      own?.(event);
      if (!event.defaultPrevented) added(event);
    };
  }
  return cloneElement(children, merged);
}
