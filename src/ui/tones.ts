export const TONES = {
  neutral:
    "bg-fill text-ink-body ring-1 ring-edge ring-inset hover:bg-fill-hover hover:text-ink hover:ring-edge-hover focus-visible:bg-fill-hover focus-visible:text-ink focus-visible:ring-edge-focus",
  outline:
    "ui-iris bg-transparent text-ink-body ring-1 ring-edge-hover ring-inset hover:text-ink hover:ring-edge-focus focus-visible:text-ink focus-visible:ring-edge-focus",
  chosen:
    "bg-accent/15 text-accent ring-1 ring-accent/25 ring-inset hover:bg-accent/20 hover:ring-accent/30 focus-visible:bg-accent/20 focus-visible:ring-accent/30",
  primary:
    "ui-sheen bg-primary text-on-primary ring-1 ring-primary ring-inset [--sheen-ink:var(--sheen-primary)] [--sheen:0.1] hover:bg-primary-hover focus-visible:bg-primary-hover",
  danger:
    "bg-danger/15 text-danger ring-1 ring-danger/25 ring-inset hover:bg-danger/20 hover:ring-danger/30 focus-visible:bg-danger/20 focus-visible:ring-danger/30",
  armed: "bg-danger text-on-accent ring-1 ring-danger ring-inset",
  glass:
    "bg-veil text-ink ring-1 ring-edge-hover ring-inset backdrop-saturate-150 hover:bg-glass focus-visible:bg-glass",
  ghost:
    "ui-iris bg-transparent text-ink-body ring-1 ring-transparent ring-inset hover:text-ink focus-visible:text-ink",
} as const;

export type Tone = keyof typeof TONES;

export const STATE = {
  disabled:
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  busy: "aria-busy:cursor-wait disabled:aria-busy:opacity-100",
} as const;

export const FILL =
  "bg-fill ring-1 ring-edge ring-inset hover:bg-fill-hover hover:ring-edge-hover focus-visible:bg-fill-hover focus-visible:ring-edge-focus";

export const LAYER = {
  shell: "bg-glass ring-1 ring-edge-hover ring-inset backdrop-saturate-150",
  tip: "bg-glass text-ink-lead ring-1 ring-edge ring-inset backdrop-saturate-150",
  veil: "bg-veil",
  dim: "bg-dim",
} as const;
