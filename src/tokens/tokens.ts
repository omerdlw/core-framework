export const Z_INDEX = Object.freeze({
  BACKGROUND: 0,
  DOCK_BACKDROP: 100,
  DOCK: 110,
  NOTIFICATION: 120,
  MODAL_BACKDROP: 130,
  MODAL: 140,
  SELECT: 150,
  LOADING: 160,
  ERROR_OVERLAY: 170,
  CONTEXT_MENU_BACKDROP: 180,
  CONTEXT_MENU: 190,
  TOOLTIP: 200,

  UI_ELEMENT: 10,
  DOCK_CARD_BACKGROUND: 0,
  DOCK_CARD_CONTENT: 10,
  DOCK_CARD_STACK_BASE: 10,
  DOCK_CARD_BADGE: 20,
  DOCK_CARD_MEDIA: 30,
  DOCK_BREADCRUMBS: 10,
  DOCK_SURFACE_CONTROL: 10,
  DOCK_SURFACE_POPOVER: 30,
  DOCK_SURFACE_CENTER: 0,
  MODAL_FRAME: 1,
  MODAL_STICKY_HEADER: 10,
} as const);

export const SURFACE_CLASSES = Object.freeze({
  description: "text-white/70",
  icon: "bg-white/10 text-white",
  surface: "bg-black/60 ring-1 ring-inset ring-white/10",
  title: "text-white",
} as const);

export const ACTION_TONE_CLASS =
  "bg-primary/10 text-primary hover:bg-primary hover:text-black";
