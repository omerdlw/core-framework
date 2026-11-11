/*
 * The interaction contract in class form. Each tone is one complete answer to
 * rest, hover, focus-visible and active, written against colour roles only
 * (styles/tokens.css), so every theme can give the same tone its own values.
 *
 * Rules every tone obeys:
 * - hover and focus-visible are one event: every `hover:` has a
 *   `focus-visible:` twin;
 * - a control rests at `ink-body` or brighter and rises to `ink`;
 * - the outline is drawn by the system (styles/interaction.css), never here;
 * - press (scale) is global; tones only colour it.
 */
export const TONES = {
  /** A quiet surface: a fill, a ring, ink-body rising to ink. */
  neutral:
    "bg-fill text-ink-body ring-1 ring-edge ring-inset hover:bg-fill-hover hover:text-ink hover:ring-edge-hover focus-visible:bg-fill-hover focus-visible:text-ink focus-visible:ring-edge-focus",
  /** A hairline and no fill: the quiet action beside a row's text. */
  outline:
    "ui-iris bg-transparent text-ink-body ring-1 ring-edge-hover ring-inset hover:text-ink hover:ring-edge-focus focus-visible:text-ink focus-visible:ring-edge-focus",
  /** A chosen control takes the accent. */
  chosen:
    "bg-accent/15 text-accent ring-1 ring-accent/25 ring-inset hover:bg-accent/20 hover:ring-accent/30 focus-visible:bg-accent/20 focus-visible:ring-accent/30",
  /** The one primary action on a surface. */
  primary:
    "ui-sheen bg-primary text-on-primary ring-1 ring-primary ring-inset [--sheen-ink:var(--sheen-primary)] [--sheen:0.1] hover:bg-primary-hover focus-visible:bg-primary-hover",
  /** A destructive action, soft until armed. */
  danger:
    "bg-danger/15 text-danger ring-1 ring-danger/25 ring-inset hover:bg-danger/20 hover:ring-danger/30 focus-visible:bg-danger/20 focus-visible:ring-danger/30",
  /** A destructive action armed for its second press. */
  armed: "bg-danger text-on-accent ring-1 ring-danger ring-inset",
  /** A control floating over a picture. */
  glass:
    "bg-veil text-ink ring-1 ring-edge-hover ring-inset backdrop-saturate-150 hover:bg-glass focus-visible:bg-glass",
  /** No surface at rest; a fill fades in when pointed at. */
  ghost:
    "ui-iris bg-transparent text-ink-body ring-1 ring-transparent ring-inset hover:text-ink focus-visible:text-ink",
} as const;

export type Tone = keyof typeof TONES;

/**
 * Disabled and busy, the same everywhere: a disabled control dims to 50% and
 * stops taking the pointer; a busy one keeps its colour and shows a wait
 * cursor while its loader runs.
 */
export const STATE = {
  disabled:
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  busy: "aria-busy:cursor-wait disabled:aria-busy:opacity-100",
} as const;

/** The neutral surface without its ink, for a control that sets its own. */
export const FILL =
  "bg-fill ring-1 ring-edge ring-inset hover:bg-fill-hover hover:ring-edge-hover focus-visible:bg-fill-hover focus-visible:ring-edge-focus";

/**
 * Layers: the glass chrome is cut from (menus, popovers, tooltips) and what
 * dims the page behind them.
 */
export const LAYER = {
  shell: "bg-glass ring-1 ring-edge-hover ring-inset backdrop-saturate-150",
  tip: "bg-glass text-ink-lead ring-1 ring-edge ring-inset backdrop-saturate-150",
  veil: "bg-veil",
  dim: "bg-dim",
} as const;
