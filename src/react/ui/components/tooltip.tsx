"use client";

import {
  isValidElement,
  type ReactElement,
  type ReactNode,
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import type { TooltipProps } from "@/react/ui/types";

import { useUi } from "../provider";
import {
  groupClosed,
  groupOpened,
  type LiveHandlers,
  type OpenKind,
  TooltipGroupContext,
} from "./tooltip-group";
import { placeTooltip } from "./tooltip-placement";
import { Slot, type TriggerProps } from "./tooltip-slot";

export { TooltipProvider } from "./tooltip-group";

const EXIT_FALLBACK_SLACK_MS = 50;

const subscribeNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

const noop = () => {};

const WRAPPER_STYLE = {
  left: 0,
  minWidth: "max-content",
  position: "fixed",
  top: 0,
  transform: "translate3d(0, -200%, 0)",
  willChange: "transform",
} as const;

function hasContent(text: ReactNode): boolean {
  return text !== undefined && text !== null && text !== false && text !== "";
}

/** Longest `duration + delay` of a computed animation list, in ms. */
function animationSpanMs(style: CSSStyleDeclaration): number {
  const toMs = (value: string) => {
    const amount = parseFloat(value);
    if (!Number.isFinite(amount)) return 0;
    return value.trim().endsWith("ms") ? amount : amount * 1000;
  };
  const durations = style.animationDuration.split(",").map(toMs);
  const delays = style.animationDelay.split(",").map(toMs);
  return durations.reduce(
    (longest, duration, index) =>
      Math.max(longest, duration + (delays[index] ?? delays[0] ?? 0)),
    0,
  );
}

/**
 * Shows a text label next to its trigger on hover or focus. The trigger is
 * the child element itself (no wrapper); the label renders in a portal and is
 * placed against the viewport, flipping and shifting to stay visible.
 *
 * The content carries `data-state` (`delayed-open`, `instant-open`, `closed`)
 * and `data-side`; it stays mounted while a CSS exit animation on
 * `data-state="closed"` runs.
 */
export function Tooltip({
  align = "center",
  children,
  className,
  classNames,
  collisionPadding = 0,
  contentProps,
  defaultOpen,
  delayMs,
  onOpenChange,
  open,
  position = "top",
  sideOffset = 0,
  text,
  triggerRef,
}: TooltipProps) {
  const { parts } = useUi();
  const { delayDuration, group, skipDelayDuration } = use(TooltipGroupContext);
  const contentId = useId();
  const isClient = useSyncExternalStore(subscribeNothing, onClient, onServer);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(
    defaultOpen ?? false,
  );
  const [openKind, setOpenKind] = useState<OpenKind>("delayed-open");
  const isControlled = open !== undefined;
  const requestedOpen = isControlled ? open : uncontrolledOpen;
  const isOpen = requestedOpen && hasContent(text);

  // Presence: keep the content mounted after closing until its exit ends.
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [exiting, setExiting] = useState(false);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setExiting(!isOpen);
  }
  const present = isOpen || exiting;

  const triggerNodeRef = useRef<HTMLElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerOpenedRef = useRef(false);
  const pointerDownRef = useRef(false);
  const openAnimationRef = useRef("none");
  const liveRef = useRef<LiveHandlers>({ close: noop, open: noop });

  const clearOpenTimer = () => {
    if (openTimerRef.current === null) return;
    clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  };

  const change = (next: boolean, kind?: OpenKind) => {
    if (kind) setOpenKind(kind);
    if (next === requestedOpen) return;
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const close = () => {
    clearOpenTimer();
    change(false);
  };

  useLayoutEffect(() => {
    liveRef.current = {
      close,
      open: (kind) => {
        clearOpenTimer();
        change(true, kind);
      },
    };
  });

  const openNow = () => {
    clearOpenTimer();
    change(true, "instant-open");
  };

  const openAfterDelay = () => {
    if (group.instant) {
      openNow();
      return;
    }
    clearOpenTimer();
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      liveRef.current.open("delayed-open");
    }, delayMs ?? delayDuration);
  };

  useEffect(() => {
    const timer = openTimerRef;
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  // Group bookkeeping, Escape and scroll dismissal while open.
  useEffect(() => {
    if (!isOpen) return;
    const live = liveRef;
    groupOpened(group, live);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") live.current.close();
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      const trigger = triggerNodeRef.current;
      if (target instanceof Node && trigger && target.contains(trigger)) {
        live.current.close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, { capture: true });
      groupClosed(group, live, skipDelayDuration);
    };
  }, [group, isOpen, skipDelayDuration]);

  // Placement: measured and written to the DOM before paint, no state.
  useLayoutEffect(() => {
    if (!present) return;
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    const trigger = triggerNodeRef.current;
    if (!wrapper || !content || !trigger) return;

    const computed = getComputedStyle(content);
    if (computed.zIndex && computed.zIndex !== "auto") {
      wrapper.style.zIndex = computed.zIndex;
    }
    openAnimationRef.current = computed.animationName || "none";

    let frame = 0;
    const place = () => {
      frame = 0;
      const box = trigger.getBoundingClientRect();
      const root = document.documentElement;
      const placement = placeTooltip({
        align,
        collisionPadding,
        content: { height: content.offsetHeight, width: content.offsetWidth },
        pixelRatio: window.devicePixelRatio,
        side: position,
        sideOffset,
        trigger: box,
        viewport: { height: root.clientHeight, width: root.clientWidth },
      });
      wrapper.style.transform = `translate3d(${placement.x}px, ${placement.y}px, 0)`;
      content.dataset.side = placement.side;
      content.style.setProperty(
        "--tooltip-transform-origin",
        `${placement.originX}px ${placement.originY}px`,
      );
      content.style.setProperty(
        "--tooltip-available-width",
        `${placement.availableWidth}px`,
      );
      content.style.setProperty(
        "--tooltip-available-height",
        `${placement.availableHeight}px`,
      );
      content.style.setProperty("--tooltip-trigger-width", `${box.width}px`);
      content.style.setProperty("--tooltip-trigger-height", `${box.height}px`);
    };
    place();

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(place);
    };
    window.addEventListener("resize", schedule, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    observer?.observe(trigger);
    observer?.observe(content);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [align, collisionPadding, position, present, sideOffset]);

  // Exit: unmount once the closed-state animation (if any) has finished.
  useLayoutEffect(() => {
    if (!exiting) return;
    const content = contentRef.current;
    const finish = () => setExiting(false);
    const computed = content ? getComputedStyle(content) : null;
    const animation = computed?.animationName || "none";
    if (
      !content ||
      !computed ||
      computed.display === "none" ||
      animation === "none" ||
      animation === openAnimationRef.current
    ) {
      // Measured in a layout effect so a tooltip without an exit animation
      // never paints its closed state.
      finish();
      return;
    }
    const onEnd = (event: AnimationEvent) => {
      if (event.target === content) finish();
    };
    content.addEventListener("animationend", onEnd);
    content.addEventListener("animationcancel", onEnd);
    const fallback = setTimeout(
      finish,
      animationSpanMs(computed) + EXIT_FALLBACK_SLACK_MS,
    );
    return () => {
      content.removeEventListener("animationend", onEnd);
      content.removeEventListener("animationcancel", onEnd);
      clearTimeout(fallback);
    };
  }, [exiting]);

  const child: ReactElement<TriggerProps> = isValidElement<TriggerProps>(
    children,
  ) ? (
    children
  ) : (
    <span>{children}</span>
  );
  const state = isOpen ? openKind : "closed";

  const trigger = (
    <Slot
      aria-describedby={isOpen ? contentId : undefined}
      data-state={state}
      forwardRef={triggerRef}
      onBlur={close}
      onClick={close}
      onFocus={() => {
        if (!pointerDownRef.current) openNow();
      }}
      onPointerDown={() => {
        pointerDownRef.current = true;
        document.addEventListener(
          "pointerup",
          () => {
            pointerDownRef.current = false;
          },
          { once: true },
        );
      }}
      onPointerLeave={() => {
        pointerOpenedRef.current = false;
        close();
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "touch" || pointerOpenedRef.current) return;
        pointerOpenedRef.current = true;
        openAfterDelay();
      }}
      ref={triggerNodeRef}
    >
      {child}
    </Slot>
  );

  return (
    <>
      {trigger}
      {present && isClient
        ? createPortal(
            <div data-tooltip-wrapper="" ref={wrapperRef} style={WRAPPER_STYLE}>
              <div
                data-align={align}
                {...contentProps}
                className={parts.tooltip.content({
                  className: [classNames?.content, className],
                })}
                data-state={state}
                id={contentId}
                ref={contentRef}
                role="tooltip"
                style={{ pointerEvents: "none", ...contentProps?.style }}
              >
                <span
                  className={parts.tooltip.label({
                    className: classNames?.label,
                  })}
                >
                  {text}
                </span>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
