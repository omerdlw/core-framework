import "../support/dom.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import {
  ModuleHost,
  usePage,
  useRegistryValue,
} from "../../src/core/kernel/index.ts";
import { defineModal, modalModule } from "../../src/modules/modal/module.tsx";
import { useModalState } from "../../src/modules/modal/context.tsx";
import {
  getModalIdentity,
  hasSlotContent,
  isSidePosition,
  isVerticalEdgePosition,
  normalizePosition,
  resolveActivePosition,
} from "../../src/modules/modal/utils.ts";

import {
  dispatchSmoothScrollLock,
  getFocusableElements,
  getModalLabel,
  getModalLayout,
  getModalPosition,
  getViewportIsMobile,
  hasHeightConstraint,
  isHeaderConfig,
  resolveHeaderActions,
  trapFocus,
} from "../../src/modules/modal/utils.ts";
import { SMOOTH_SCROLL_LOCK_EVENT } from "../../src/modules/modal/constants.ts";

describe("modal page", () => {
  const { Overlay, ...headlessModal } = modalModule;

  async function renderPage(config) {
    const seen: Record<string, any> = {};
    function Page() {
      (seen as any).page = usePage(config);
      (seen as any).registered = useRegistryValue("modal", "confirm");
      return null;
    }
    function State() {
      (seen as any).state = useModalState();
      return null;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () =>
      root.render(
        h(ModuleHost, { modules: [headlessModal] }, h(Page), h(State)),
      ),
    );
    return { seen, unmount: () => act(async () => root.unmount()) };
  }

  function confirm() {
    return null;
  }

  describe("modal page API", () => {
    test("usePage({ modal }) registers components by id, unwrapped", async () => {
      const { seen, unmount } = await renderPage({ modal: { confirm } });
      assert.equal(
        (seen as any).registered,
        confirm,
        "the component itself, not a proxy",
      );
      await unmount();
    });

    test("open(id) opens the page's modal; closeModal closes it", async () => {
      const { seen, unmount } = await renderPage({ modal: { confirm } });
      await act(async () => {
        (seen as any).page.modules.modal.open("confirm", { answer: 42 });
      });
      assert.equal((seen as any).state.modalStack.length, 1);
      assert.equal((seen as any).state.modalStack[0].component, confirm);
      assert.deepEqual((seen as any).state.modalStack[0].props, { answer: 42 });

      await act(async () => (seen as any).page.modules.modal.closeModal());
      assert.equal((seen as any).state.modalStack.length, 0);
      await unmount();
    });

    test("open(definition) merges the definition's default data", async () => {
      const Settings = defineModal({
        component: confirm,
        defaultData: { tab: "general" },
        id: "settings",
      });
      const { seen, unmount } = await renderPage({});
      await act(async () => {
        (seen as any).page.modules.modal.open(Settings, { user: "ada" });
      });
      const [entry] = (seen as any).state.modalStack;
      assert.equal(entry.modalType, "settings");
      assert.deepEqual(entry.props, { tab: "general", user: "ada" });
      await unmount();
    });

    test("an unknown id opens the registered modal type of that name", async () => {
      const { seen, unmount } = await renderPage({});
      await act(async () => {
        (seen as any).page.modules.modal.open("global-help");
      });
      assert.equal((seen as any).state.modalStack[0].modalType, "global-help");
      await unmount();
    });
  });
});

describe("modal utils", () => {
  describe("getModalIdentity", () => {
    test("a string is the type", () => {
      assert.deepEqual(getModalIdentity("confirm"), {
        component: null,
        type: "confirm",
      });
    });

    test("a component function is named by its displayName, then its name", () => {
      function Confirm() {}
      function Named() {}
      Named.displayName = "Pretty";

      assert.equal(getModalIdentity(Confirm as any).type, "Confirm");
      assert.equal(getModalIdentity(Named as any).type, "Pretty");
      assert.equal(getModalIdentity(Confirm as any).component, Confirm);
    });

    test("an options object prefers type, then id", () => {
      const component = () => null;

      assert.equal(
        getModalIdentity({ component, id: "a", type: "b" }).type,
        "b",
      );
      assert.equal(getModalIdentity({ component, id: "a" }).type, "a");
    });
  });

  describe("modal positions", () => {
    test("side and vertical edge detection", () => {
      assert.equal(isSidePosition("left"), true);
      assert.equal(isSidePosition("right"), true);
      assert.equal(isSidePosition("center"), false);
      assert.equal(isVerticalEdgePosition("top"), true);
      assert.equal(isVerticalEdgePosition("bottom"), true);
      assert.equal(isVerticalEdgePosition(undefined), false);
    });

    test("a plain position passes through; anything else is centred", () => {
      assert.deepEqual(normalizePosition("left"), {
        position: "left",
        responsivePosition: null,
      });
      assert.deepEqual(normalizePosition(undefined), {
        position: "center",
        responsivePosition: null,
      });
    });

    test("a responsive position picks desktop or mobile", () => {
      const responsive = { desktop: "right", mobile: "bottom" };

      assert.equal(
        resolveActivePosition("center", responsive as any, false),
        "right",
      );
      assert.equal(
        resolveActivePosition("center", responsive as any, true),
        "bottom",
      );
      assert.equal(
        resolveActivePosition("center", { desktop: "right" }, true),
        "center",
      );
      assert.equal(resolveActivePosition("left", null, true), "left");
    });

    test("hasSlotContent is false for empty slots", () => {
      assert.equal(hasSlotContent(null), false);
      assert.equal(hasSlotContent(""), false);
      assert.equal(hasSlotContent("x"), true);
    });
  });
});

describe("modal utils: layout", () => {
  test("unknown positions fall back to center", () => {
    assert.equal(getModalPosition("top"), "top");
    assert.equal(getModalPosition("right"), "right");
    assert.equal(getModalPosition("anything" as any), "center");
  });

  test("the layout combines the edge with the viewport", () => {
    assert.equal(getModalLayout("bottom", false), "bottom");
    assert.equal(getModalLayout("top", false), "top");
    assert.equal(getModalLayout("left", false), "left");
    assert.equal(getModalLayout("right", false), "right");
    assert.equal(getModalLayout("top", true), "top-mobile");
    assert.equal(getModalLayout("bottom", true), "bottom-mobile");
    assert.equal(getModalLayout("left", true), "side-mobile");
    assert.equal(getModalLayout("right", true), "side-mobile");
    assert.equal(getModalLayout("center", true), "center");
  });

  test("height constraints are detected in Tailwind classes, including variants", () => {
    assert.equal(hasHeightConstraint("h-96"), true);
    assert.equal(hasHeightConstraint("p-4 max-h-[80vh]"), true);
    assert.equal(hasHeightConstraint("md:h-64"), true);
    assert.equal(hasHeightConstraint("w-96 p-4"), false);
    assert.equal(hasHeightConstraint("shadow-h"), false);
    assert.equal(hasHeightConstraint(undefined), false);
  });

  test("the mobile viewport is read from matchMedia", () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes("max-width"),
    })) as any;
    assert.equal(getViewportIsMobile(), true);
    (window as any).matchMedia = undefined;
    assert.equal(getViewportIsMobile(), false);
    window.matchMedia = original;
  });

  test("modal labels are humanised from their type", () => {
    assert.equal(getModalLabel("confirm-delete"), "Confirm Delete");
    assert.equal(getModalLabel("  USER_SETTINGS "), "User Settings");
    assert.equal(getModalLabel(""), "Modal");
    assert.equal(getModalLabel(null), "Modal");
  });
});

describe("modal utils: header and scroll lock", () => {
  test("header config is a plain object, not an element or array", () => {
    assert.equal(isHeaderConfig({ title: "x" }), true);
    assert.equal(isHeaderConfig([]), false);
    assert.equal(isHeaderConfig(null), false);
    assert.equal(isHeaderConfig("text"), false);
  });

  test("header actions may be nodes or functions of close", () => {
    const close = () => {};
    let received: any;

    assert.equal(resolveHeaderActions("x"), "x");
    assert.equal(resolveHeaderActions(undefined), null);
    resolveHeaderActions((props: any) => (received = props.close), close);
    assert.equal(received, close);
  });

  test("the scroll lock event announces who locked", () => {
    const seen: any[] = [];
    const listener = (e: any) => seen.push(e.detail);
    window.addEventListener(SMOOTH_SCROLL_LOCK_EVENT, listener);

    dispatchSmoothScrollLock(true);
    dispatchSmoothScrollLock(false);
    window.removeEventListener(SMOOTH_SCROLL_LOCK_EVENT, listener);

    assert.deepEqual(seen, [
      { locked: true, source: "modal" },
      { locked: false, source: "modal" },
    ]);
  });
});

describe("modal focus management", () => {
  function dialog() {
    const container = document.createElement("div");
    container.innerHTML =
      '<button id="a">A</button><button id="b" disabled>B</button><a id="c" href="#">C</a>' +
      '<button id="d" aria-hidden="true">D</button><input id="e" />';
    document.body.appendChild(container);
    return container;
  }
  const tab = (shiftKey = false) =>
    new window.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
      shiftKey,
    });

  test("only enabled, visible focusable elements are returned", () => {
    const ids = getFocusableElements(dialog()).map((el) => el.id);

    assert.deepEqual(ids, ["a", "c", "e"]);
    assert.deepEqual(getFocusableElements(null), []);
  });

  test("Tab on the last element wraps to the first", () => {
    const container = dialog();
    (container.querySelector("#e") as HTMLElement).focus();
    const event = tab();

    trapFocus(event as any, container);

    assert.equal(event.defaultPrevented, true);
    assert.equal(document.activeElement?.id, "a");
  });

  test("Shift+Tab on the first element wraps to the last", () => {
    const container = dialog();
    (container.querySelector("#a") as HTMLElement).focus();
    const event = tab(true);

    trapFocus(event as any, container);

    assert.equal(event.defaultPrevented, true);
    assert.equal(document.activeElement?.id, "e");
  });

  test("Tab in the middle is left to the browser", () => {
    const container = dialog();
    (container.querySelector("#c") as HTMLElement).focus();
    const event = tab();

    trapFocus(event as any, container);

    assert.equal(event.defaultPrevented, false);
  });

  test("other keys and empty containers are ignored", () => {
    const container = dialog();
    const other = new window.KeyboardEvent("keydown", {
      cancelable: true,
      key: "a",
    });

    trapFocus(other as any, container);
    trapFocus(tab() as any, document.createElement("div"));
    trapFocus(tab() as any, null);

    assert.equal(other.defaultPrevented, false);
  });
});
