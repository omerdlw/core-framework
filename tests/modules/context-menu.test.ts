import "../support/dom.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setReportSink } from "../../src/core/utils/index.ts";

import { createElement as h } from "react";
import {
  extractNodeText,
  resolveAsBoolean,
  resolveAsValue,
  resolveContextMenuPageMeta,
  resolveMenuHeader,
  resolveMenuItems,
  safeInvoke,
} from "../../src/modules/context-menu/items.ts";
import {
  getNextActiveIndex,
  isScrollLockKey,
  joinClassNames,
  positionMenu,
} from "../../src/modules/context-menu/dom.ts";
import {
  prepareMenu,
  resolveContextMenu,
} from "../../src/modules/context-menu/resolver.ts";

import { MENU_SCREEN_MARGIN } from "../../src/modules/context-menu/constants.ts";

describe("context menu utils", () => {
  describe("safeInvoke", () => {
    test("returns the handler's result", () => {
      assert.equal(
        safeInvoke((a, b) => a + b, 1, 2),
        3,
      );
    });

    test("non-functions are a no-op", () => {
      assert.equal(safeInvoke(null), undefined);
      assert.equal(safeInvoke("nope"), undefined);
    });

    test("a throwing handler is reported and swallowed", () => {
      const reported: any[] = [];
      const release = setReportSink((scope, error) =>
        reported.push([scope, (error as any).message] as any),
      );

      const result = safeInvoke(() => {
        throw new Error("menu action failed");
      });
      release();

      assert.equal(result, undefined);
      assert.deepEqual(reported, [
        ["Context menu callback", "menu action failed"],
      ]);
    });

    test("a rejected promise is reported and not left unhandled", async () => {
      const reported: any[] = [];
      const release = setReportSink((scope, error) =>
        reported.push([scope, (error as any).message] as any),
      );

      safeInvoke(() => Promise.reject(new Error("async failed")));
      await new Promise((resolve) => setImmediate(resolve));
      release();

      assert.deepEqual(reported, [
        ["Context menu async callback", "async failed"],
      ]);
    });
  });
});

describe("context menu value helpers", () => {
  test("joinClassNames drops falsy parts", () => {
    assert.equal(joinClassNames("a", false, null, undefined, "b"), "a b");
  });

  test("isScrollLockKey covers the keys that scroll the page", () => {
    for (const key of ["ArrowDown", "PageUp", " ", "Home"]) {
      assert.equal(isScrollLockKey({ key }), true, key);
    }
    assert.equal(isScrollLockKey({ key: "a" }), false);
  });

  test("extractNodeText flattens text out of React nodes", () => {
    assert.equal(extractNodeText("plain"), "plain");
    assert.equal(extractNodeText(3), "3");
    assert.equal(
      extractNodeText(["a", h("b", null, "b", " c"), null]),
      "a b c",
    );
    assert.equal(extractNodeText({}), "");
  });

  test("resolveAsBoolean evaluates functions safely", () => {
    assert.equal(resolveAsBoolean(undefined, null, true), true);
    assert.equal(resolveAsBoolean(undefined, null, false), false);
    assert.equal(
      resolveAsBoolean((ctx) => ctx.ok, { ok: true }),
      true,
    );
    assert.equal(
      resolveAsBoolean(() => {
        throw new Error("x");
      }),
      false,
    );
    assert.equal(resolveAsBoolean(0, null, true), false);
  });

  test("resolveAsValue evaluates functions and falls back on undefined or failure", () => {
    assert.equal(resolveAsValue("x"), "x");
    assert.equal(resolveAsValue(undefined, null, "fb"), "fb");
    assert.equal(
      resolveAsValue((c) => c.n, { n: 4 }),
      4,
    );
    assert.equal(
      resolveAsValue(() => undefined, null, "fb"),
      "fb",
    );
    assert.equal(
      resolveAsValue(
        () => {
          throw new Error("x");
        },
        null,
        "fb",
      ),
      "fb",
    );
  });
});

describe("resolveMenuItems", () => {
  const ctx: any = { pathname: "/", point: { x: 0, y: 0 } };
  const labels = (items: any[]) => items.map((i) => i.label ?? i.type);

  test("resolves labels, defaults and handlers", () => {
    const onClick = () => {};
    const [item] = resolveMenuItems(
      { items: [{ label: "Copy", onClick }] },
      ctx,
    );

    assert.equal(item.type, "action");
    assert.equal(item.label, "Copy");
    assert.equal(item.key, "item-0");
    assert.equal(item.closeOnSelect, true);
    assert.equal(item.disabled, false);
    assert.equal(item.danger, false);
    assert.equal(item.onSelect, onClick);
  });

  test("hidden, invisible and label-less items are dropped", () => {
    const items = resolveMenuItems(
      {
        items: [
          { label: "Shown" },
          { hidden: true, label: "Hidden" },
          { label: "Invisible", visible: () => false },
          { label: "   " },
          { label: () => null },
          null,
        ] as any,
      },
      ctx,
    );

    assert.deepEqual(labels(items), ["Shown"]);
  });

  test("function-valued fields receive the context", () => {
    const [item] = resolveMenuItems(
      {
        items: [
          {
            danger: (c: any) => c.pathname === "/",
            disabled: () => true,
            label: (c: any) => `At ${c.pathname}`,
            shortcut: () => "⌘K",
          },
        ],
      },
      ctx,
    );

    assert.equal(item.label, "At /");
    assert.equal(item.danger, true);
    assert.equal(item.disabled, true);
    assert.equal(item.shortcut, "⌘K");
  });

  test("separators are trimmed from the edges and never doubled", () => {
    const items = resolveMenuItems(
      {
        items: [
          "separator",
          { label: "A" },
          "separator",
          { type: "separator" },
          { label: "B" },
          "separator",
        ] as any,
      },
      ctx,
    );

    assert.deepEqual(labels(items), ["A", "separator", "B"]);
  });

  test("a separator left dangling by a hidden item is removed", () => {
    const items = resolveMenuItems(
      {
        items: [
          { label: "A" },
          "separator",
          { hidden: true, label: "B" },
        ] as any,
      },
      ctx,
    );

    assert.deepEqual(labels(items), ["A"]);
  });

  test("items may be produced by a function, and failures give an empty menu", () => {
    assert.deepEqual(
      labels(resolveMenuItems({ items: () => [{ label: "Dyn" }] }, ctx)),
      ["Dyn"],
    );
    assert.deepEqual(
      resolveMenuItems(
        {
          items: () => {
            throw new Error("x");
          },
        },
        ctx,
      ),
      [],
    );
    assert.deepEqual(resolveMenuItems(null, ctx), []);
  });

  test("closeOnSelect: false is respected", () => {
    const [item] = resolveMenuItems(
      { items: [{ closeOnSelect: false, label: "Stay" }] },
      ctx,
    );

    assert.equal(item.closeOnSelect, false);
  });
});

describe("resolveMenuHeader and page meta", () => {
  test("uses the configured header, else the page meta", () => {
    const fromConfig = resolveMenuHeader(
      { header: { title: "Config", description: "d" } },
      {} as any,
    );
    const fromPage = resolveMenuHeader({}, { page: { title: "Page" } } as any);

    assert.equal(fromConfig?.titleText, "Config");
    assert.equal(fromConfig?.descriptionText, "d");
    assert.equal(fromPage?.titleText, "Page");
  });

  test("header: false or showPageHeader: false hides it", () => {
    assert.equal(
      resolveMenuHeader({ header: false }, { page: { title: "x" } } as any),
      null,
    );
    assert.equal(
      resolveMenuHeader({ showPageHeader: false }, {
        page: { title: "x" },
      } as any),
      null,
    );
    assert.equal(resolveMenuHeader({}, {} as any), null);
    assert.equal(resolveMenuHeader({ header: {} }, {} as any), null);
  });

  test("resolveContextMenuPageMeta prefers contextMenu* fields and falls back to the path", () => {
    const meta = resolveContextMenuPageMeta(
      { contextMenuTitle: "Menu title", title: "Page title" },
      "/fallback",
    );

    assert.equal(meta?.titleText, "Menu title");
    assert.equal(meta?.path, "/fallback");
    assert.equal(
      resolveContextMenuPageMeta({ path: "/own", title: "x" })?.path,
      "/own",
    );
    assert.equal(resolveContextMenuPageMeta({}), null);
    assert.equal(resolveContextMenuPageMeta(null), null);
  });
});

describe("menu navigation and positioning", () => {
  const item = (type: string, disabled = false) => ({ disabled, type }) as any;

  test("getNextActiveIndex skips separators and disabled items and wraps", () => {
    const items = [
      item("action"),
      item("separator"),
      item("action", true),
      item("action"),
    ];

    assert.equal(getNextActiveIndex(items, -1, 1), 0);
    assert.equal(getNextActiveIndex(items, -1, -1), 3);
    assert.equal(getNextActiveIndex(items, 0, 1), 3);
    assert.equal(getNextActiveIndex(items, 3, 1), 0);
    assert.equal(getNextActiveIndex(items, 0, -1), 3);
  });

  test("with nothing selectable the index does not move", () => {
    assert.equal(
      getNextActiveIndex([item("separator"), item("action", true)], 1, 1),
      1,
    );
  });

  test("positionMenu keeps the menu inside the viewport", () => {
    const menu = document.createElement("div");
    menu.getBoundingClientRect = () => ({ height: 100, width: 200 }) as any;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });

    positionMenu(menu, { x: 950, y: 790 });
    const nearEdge = [menu.style.left, menu.style.top];
    positionMenu(menu, { x: 10, y: 20 });

    assert.ok(parseInt(nearEdge[0]) <= 1000 - 200);
    assert.ok(parseInt(nearEdge[1]) <= 800 - 100);
    assert.equal(menu.style.left, `${MENU_SCREEN_MARGIN}px`);
    assert.equal(menu.style.top, "20px");
    assert.doesNotThrow(() => positionMenu(null, { x: 1, y: 1 }));
  });
});

describe("resolveContextMenu", () => {
  function contextmenu(target?: Element) {
    const element = target ?? document.createElement("div");
    let root: Element = element;
    while (root.parentElement) root = root.parentElement;
    document.body.appendChild(root);
    let captured: MouseEvent | null = null;
    element.addEventListener("contextmenu", (e: any) => (captured = e), {
      once: true,
    });
    element.dispatchEvent(
      new window.MouseEvent("contextmenu", {
        bubbles: true,
        clientX: 5,
        clientY: 6,
      }),
    );
    return captured as unknown as MouseEvent;
  }
  const items = [{ label: "Do it" }];

  test("nothing registered resolves to no menu", () => {
    assert.equal(resolveContextMenu({}, "/", contextmenu()), null);
    assert.equal(resolveContextMenu(null, "/", contextmenu()), null);
  });

  test("a menu registered for the current path wins and carries its context", () => {
    const match = resolveContextMenu(
      { "/a": { items, payload: { id: 1 } } },
      "/a",
      contextmenu(),
    );

    assert.equal(match?.items.length, 1);
    assert.deepEqual(match?.context.payload, { id: 1 });
    assert.deepEqual(match?.context.point, { x: 5, y: 6 });
    assert.equal(match?.context.pathname, "/a");
  });

  test("menus for other paths do not apply", () => {
    assert.equal(
      resolveContextMenu({ "/b": { items } }, "/a", contextmenu()),
      null,
    );
  });

  test("current-page and global menus apply anywhere", () => {
    assert.ok(
      resolveContextMenu({ "current-page": { items } }, "/a", contextmenu()),
    );
    assert.ok(resolveContextMenu({ "*": { items } }, "/zzz", contextmenu()));
  });

  test("a route-specific menu outranks current-page, which outranks global", () => {
    const registry = {
      "*": { items: [{ label: "global" }] },
      "/a": { items: [{ label: "route" }] },
      "current-page": { items: [{ label: "page" }] },
    };

    assert.equal(
      resolveContextMenu(registry, "/a", contextmenu())?.items[0].label,
      "route",
    );
    const { "/a": _removed, ...rest } = registry;
    assert.equal(
      resolveContextMenu(rest, "/a", contextmenu())?.items[0].label,
      "page",
    );
  });

  test("an explicit priority beats route specificity", () => {
    const registry = {
      "*": { items: [{ label: "boosted" }], priority: 1 },
      "/a": { items: [{ label: "route" }] },
    };

    assert.equal(
      resolveContextMenu(registry, "/a", contextmenu())?.items[0].label,
      "boosted",
    );
  });

  test("path and paths whitelist routes explicitly", () => {
    const registry = { custom: { items, paths: ["/x", "/y"] } };

    assert.ok(resolveContextMenu(registry, "/y", contextmenu()));
    assert.equal(resolveContextMenu(registry, "/z", contextmenu()), null);
    assert.ok(
      resolveContextMenu(
        { custom: { items, path: "/z" } },
        "/z",
        contextmenu(),
      ),
    );
  });

  test("pathMatcher decides when given, and a throwing matcher means no menu", () => {
    assert.ok(
      resolveContextMenu(
        { m: { items, pathMatcher: (p: string) => p.startsWith("/acc") } },
        "/account",
        contextmenu(),
      ),
    );
    assert.equal(
      resolveContextMenu(
        {
          m: {
            items,
            pathMatcher: () => {
              throw new Error("x");
            },
          },
        },
        "/a",
        contextmenu(),
      ),
      null,
    );
  });

  test("target selectors require the right-clicked element to match", () => {
    const card = document.createElement("div");
    card.className = "card";
    const inner = document.createElement("span");
    card.appendChild(inner);
    const registry = { "*": { items, target: ".card" } };

    assert.ok(resolveContextMenu(registry, "/", contextmenu(inner)));
    assert.equal(
      resolveContextMenu(
        registry,
        "/",
        contextmenu(document.createElement("p")),
      ),
      null,
    );
  });

  test("the more specific target wins", () => {
    const card = document.createElement("div");
    card.className = "card";
    const row = document.createElement("div");
    row.className = "row";
    card.appendChild(row);
    const registry = {
      card: { items: [{ label: "card" }], path: "/", target: ".card" },
      row: { items: [{ label: "row" }], path: "/", target: ".row" },
    };

    assert.equal(
      resolveContextMenu(registry, "/", contextmenu(row))?.items[0].label,
      "row",
    );
  });

  test("enabled and when can veto, and throwing guards fail closed", () => {
    const base = { items, path: "/" };

    assert.equal(
      resolveContextMenu(
        { a: { ...base, enabled: false } },
        "/",
        contextmenu(),
      ),
      null,
    );
    assert.equal(
      resolveContextMenu({ a: { ...base, when: false } }, "/", contextmenu()),
      null,
    );
    assert.equal(
      resolveContextMenu(
        { a: { ...base, when: () => false } },
        "/",
        contextmenu(),
      ),
      null,
    );
    assert.equal(
      resolveContextMenu(
        {
          a: {
            ...base,
            when: () => {
              throw new Error("x");
            },
          },
        },
        "/",
        contextmenu(),
      ),
      null,
    );
    assert.ok(
      resolveContextMenu(
        { a: { ...base, when: () => true } },
        "/",
        contextmenu(),
      ),
    );
  });

  test("a menu that resolves to no items is skipped in favour of the next", () => {
    const registry = {
      "*": { items: [{ label: "fallback" }] },
      "/a": { items: [{ hidden: true, label: "gone" }] },
    };

    assert.equal(
      resolveContextMenu(registry, "/a", contextmenu())?.items[0].label,
      "fallback",
    );
  });

  test("nested menus inherit shared config and may override it", () => {
    const registry = {
      "/a": {
        enabled: true,
        menus: [
          { items: [{ label: "first" }], target: ".nope" },
          { items: [{ label: "second" }] },
        ],
      },
    };

    assert.equal(
      resolveContextMenu(registry, "/a", contextmenu())?.items[0].label,
      "second",
    );
  });

  test("resolvePayload and resolveContext enrich the context", () => {
    const match = resolveContextMenu(
      {
        "/a": {
          items,
          resolveContext: (_e: any, ctx: any) => ({ extra: ctx.payload.n + 1 }),
          resolvePayload: () => ({ n: 1 }),
        },
      },
      "/a",
      contextmenu(),
    );

    assert.deepEqual(match?.context.payload, { n: 1 });
    assert.equal((match?.context as any).extra, 2);
  });

  test("elements marked to ignore the menu are looked through", () => {
    const overlay = document.createElement("div");
    overlay.setAttribute("data-context-menu-overlay", "");
    const registry = { "*": { items } };

    assert.ok(resolveContextMenu(registry, "/", contextmenu(overlay)));
  });
});

describe("prepareMenu", () => {
  const ctx: any = { pathname: "/" };

  test("returns the resolved items and the context", () => {
    const prepared = prepareMenu({ items: [{ label: "A" }] }, ctx, {});

    assert.equal(prepared?.items.length, 1);
    assert.equal(prepared?.context, ctx);
  });

  test("onOpen returning false cancels the menu", () => {
    assert.equal(
      prepareMenu({ items: [{ label: "A" }], onOpen: () => false }, ctx, {}),
      null,
    );
  });

  test("onOpen may extend the context used to resolve items", () => {
    const prepared = prepareMenu(
      {
        items: (c: any) => [{ label: `User ${c.user}` }],
        onOpen: () => ({ user: "ada" }),
      },
      ctx,
      {},
    );

    assert.equal(prepared?.items[0].label, "User ada");
    assert.equal((prepared?.context as any).user, "ada");
  });

  test("a menu with no items does not open", () => {
    assert.equal(prepareMenu({ items: [] }, ctx, {}), null);
  });
});
