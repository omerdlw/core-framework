import "../support/dom.ts";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import {
  Compose,
  composeProviders,
  createProviderEntry,
} from "../../src/core/kernel/compose.ts";
import { act, createContext, createElement as h, use } from "react";
import { createRoot } from "react-dom/client";
import {
  ModuleHost,
  PageControllerProvider,
  RegistryProvider,
  applyRegistryConfig,
  createModuleRegistryDefinitions,
  createRegistryApplyContext,
  createRegistryStore,
  defineModule,
  sortModules,
  useModule,
  useModuleRegistration,
  usePage,
  usePageController,
  useRegistryValue,
} from "../../src/core/kernel/index.ts";
import { createStore } from "../../src/core/utils/store.ts";
import { loadingModule } from "../../src/modules/loading/module.tsx";
import { ThemeProvider } from "../../src/theme.tsx";
import {
  ambientThemeConfig,
  loadingThemeConfig,
  primitivesThemeConfig,
} from "../support/themes.ts";
import {
  useLoadingActions,
  useLoadingRegistration,
  useLoadingState,
} from "../../src/modules/loading/context.tsx";
import {
  ModalProvider,
  useModal,
  useModalActions,
  useModalState,
} from "../../src/modules/modal/context.tsx";
import { modalModule } from "../../src/modules/modal/module.tsx";
import {
  NotificationProvider,
  useNotificationActions,
  useNotificationState,
} from "../../src/modules/notification/context.tsx";
import { useToast } from "../../src/modules/notification/hooks.ts";
import { notificationModule } from "../../src/modules/notification/module.tsx";
import {
  AmbientProvider,
  useAmbient,
  useAmbientTheme,
} from "../../src/modules/ambient/context.tsx";
import { ambientModule } from "../../src/modules/ambient/module.tsx";
import {
  ContextMenuProvider,
  useContextMenu,
  useContextMenuActions,
  useContextMenuState,
} from "../../src/modules/context-menu/context.tsx";
import { CONTEXT_MENU_VISIBILITY_EVENT } from "../../src/modules/context-menu/constants.ts";
import { contextMenuModule } from "../../src/modules/context-menu/module.tsx";
import { navigationTestState } from "../support/next-navigation.mjs";
import {
  useBackgroundActions,
  useBackgroundState,
} from "../../src/modules/background/context.tsx";
import { backgroundModule } from "../../src/modules/background/module.tsx";
import {
  builtInModules,
  createRegistryStore as createRegistryStore__4,
  createRegistryStore as createRegistryStore__6,
  registryOperations,
} from "../support/registry.ts";
import { applyRegistryConfig as applyPayload } from "../../src/core/kernel/handlers.ts";
import { createRegistryApplyContext as createRegistryApplyContext__4 } from "../../src/core/kernel/hooks.ts";
import { createModulePayload } from "../../src/core/kernel/installed.ts";
import {
  createRecordKey,
  createRegisterOperation,
  createUnregisterOperation,
} from "../../src/core/kernel/operations.ts";

describe("compose", () => {
  function OuterProvider({ children }) {
    return children;
  }

  function MiddleProvider({ mode, children }) {
    return children;
  }

  function InnerProvider({ children }) {
    return children;
  }

  test("Compose flattens providers from outermost to innermost", () => {
    const tree = Compose({
      providers: [
        OuterProvider,
        createProviderEntry(MiddleProvider as any, { mode: "strict" }),
        InnerProvider,
      ],
      children: "LeafContent",
    });

    assert.equal(tree.type, OuterProvider);

    const middle = tree.props.children;
    assert.equal(middle.type, MiddleProvider);
    assert.equal(middle.props.mode, "strict");

    const inner = middle.props.children;
    assert.equal(inner.type, InnerProvider);

    const leafFragment = inner.props.children;
    assert.equal(leafFragment.props.children, "LeafContent");
  });

  test("composeProviders returns a reusable component with ComposedProviders displayName", () => {
    const AppProviders = composeProviders([
      OuterProvider,
      [MiddleProvider, { mode: "custom" }],
    ]);

    assert.equal((AppProviders as any).displayName, "ComposedProviders");

    const tree = AppProviders({ children: "AppBody" });
    assert.equal(tree.type, OuterProvider);
    assert.equal(tree.props.children.type, MiddleProvider);
    assert.equal(tree.props.children.props.mode, "custom");
    assert.equal(tree.props.children.props.children.props.children, "AppBody");
  });

  test("Compose handles empty providers array gracefully", () => {
    const tree = Compose({
      providers: [] as any[],
      children: "DirectChild",
    });

    assert.equal(tree.props.children, "DirectChild");
  });
});

describe("module host", () => {
  async function render(element) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(element));
    return {
      container,
      rerender: (next) => act(async () => root.render(next)),
      unmount: () => act(async () => root.unmount()),
    };
  }

  function createRuntimeModule(id, extra = {}) {
    const context = createContext(null);
    const runtime = { actions: { id }, store: createStore({ id }) };
    return defineModule({
      id,
      context,
      Provider: ({ children }) =>
        (h as any)(context, { value: runtime }, children),
      ...extra,
    });
  }

  function createEntriesModule(id, registry = {}) {
    return defineModule({
      id,
      page: {
        entries: (slice) =>
          Object.entries(slice).map(([key, value]) => ({ key, value })),
        use: (slice, page) => ({ slice, set: page.set }),
      },
      registry: { keyPolicy: "named", lifecycle: "immediate", ...registry },
    });
  }

  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
  afterEach(() => mock.timers.reset());

  describe("module kernel: install order", () => {
    test("modules follow the modules they use; otherwise array order", () => {
      const ids = sortModules([
        { id: "dock", uses: ["background", "loading"] },
        { id: "modal" },
        { id: "loading" },
        { id: "background", uses: ["missing"] },
      ]).map((module) => module.id);
      assert.deepEqual(ids, ["background", "loading", "dock", "modal"]);
    });

    test("duplicate ids and dependency cycles are rejected", () => {
      assert.throws(() => sortModules([{ id: "a" }, { id: "a" }]), /twice/);
      assert.throws(
        () =>
          sortModules([
            { id: "a", uses: ["b"] },
            { id: "b", uses: ["a"] },
          ]),
        /cycle: a -> b -> a/,
      );
    });
  });

  describe("module kernel: host and useModule", () => {
    test("useModule returns an installed module's runtime, null otherwise", async () => {
      const seen: Record<string, any> = {};
      function Probe() {
        seen.alpha = useModule("alpha" as any);
        seen.beta = useModule("beta" as any);
        return null;
      }
      const view = await render(
        h(ModuleHost, { modules: [createRuntimeModule("alpha")] }, h(Probe)),
      );
      assert.equal(seen.alpha.actions.id, "alpha");
      assert.equal(seen.beta, null);
      await view.unmount();
    });

    test("useModule works outside a host (null) instead of throwing", async () => {
      let seen;
      function Probe() {
        seen = useModule("alpha" as any);
        return null;
      }
      const view = await render(h(Probe));
      assert.equal(seen, null);
      await view.unmount();
    });

    test("a module's provider sees the modules it uses", async () => {
      let seenFromDock;
      const background = createRuntimeModule("background");
      const dockContext = createContext(null);
      function DockProvider({ children }) {
        seenFromDock = useModule("background");
        return h(dockContext, { value: null }, children);
      }
      const dock = defineModule({
        id: "dock",
        Provider: DockProvider as any,
        uses: ["background"],
      });
      const view = await render(
        (h as any)(ModuleHost, { modules: [dock, background] }),
      );
      assert.equal(seenFromDock.actions.id, "background");
      await view.unmount();
    });

    test("backdrops render before the page and overlays after it, in boundaries", async () => {
      const boundaries: any[] = [];
      function Boundary({ children, name }) {
        boundaries.push(name);
        return children;
      }
      const shell = defineModule({
        id: "shell",
        Backdrop: () => h("i", { id: "backdrop" }),
        Overlay: () => h("i", { id: "overlay" }),
      });
      const view = await render(
        (h as any)(
          ModuleHost,
          { boundary: Boundary, modules: [shell] },
          h("i", { id: "page" }),
        ),
      );
      const order = [...view.container.querySelectorAll("i")].map((n) => n.id);
      assert.deepEqual(order, ["backdrop", "page", "overlay"]);
      assert.deepEqual(boundaries, ["shell", "shell"]);
      await view.unmount();
    });
  });

  describe("module kernel: registry definitions per store", () => {
    test("a store only accepts the registry types it was created with", () => {
      const definitions = new Map([
        ["notes", { keyPolicy: "named", lifecycle: "immediate" }],
      ]);
      const store = createRegistryStore([], definitions as any);
      const accepted = store.register("notes", "a", { text: "x" });
      const rejected = store.register("dock", "/", { title: "x" });
      assert.equal(accepted.status, "active");
      assert.equal(rejected.status, "rejected");
      assert.deepEqual(store.getSnapshot("notes", "a"), { text: "x" });
    });

    test("a definition's merge combines records, lowest priority first", () => {
      const definitions = new Map([
        [
          "tags",
          {
            keyPolicy: "named",
            lifecycle: "immediate",
            merge: (values) => ({ tags: values.flatMap((v) => v.tags) }),
          },
        ],
      ]);
      const store = createRegistryStore([], definitions as any);
      store.register("tags", "k", { tags: ["user"] }, "user");
      store.register("tags", "k", { tags: ["static"] }, "static");
      assert.deepEqual(store.getSnapshot("tags", "k"), {
        tags: ["static", "user"],
      });
    });

    test("singleton and route key policies come from the definition", () => {
      const definitions = new Map([
        [
          "one",
          {
            keyPolicy: "singleton",
            lifecycle: "immediate",
            singletonKey: "only",
          },
        ],
        [
          "routes",
          { keyPolicy: "route", lifecycle: "immediate", reservedKeys: ["*"] },
        ],
      ]);
      const store = createRegistryStore([], definitions as any);
      assert.equal(store.register("one", "only", {}).status, "active");
      assert.equal(store.register("one", "other", {}).status, "rejected");
      assert.equal(store.register("routes", "/a", {}).status, "active");
      assert.equal(store.register("routes", "*", {}).status, "active");
      assert.equal(store.register("routes", "a", {}).status, "rejected");
    });
  });

  describe("module kernel: page slices", () => {
    function renderPageWith(modules, useHook) {
      const probe: Record<string, any> = {};
      function Page() {
        probe.value = useHook();
        return null;
      }
      function Reader() {
        probe.a = useRegistryValue("notes", "a");
        probe.b = useRegistryValue("notes", "b");
        return null;
      }
      return {
        probe,
        view: render(h(ModuleHost, { modules }, h(Page), h(Reader))),
      };
    }

    test("usePage registers a module's entries and exposes its page API", async () => {
      const notes = createEntriesModule("notes");
      const { probe, view } = renderPageWith([notes], () =>
        usePage({ notes: { a: { text: "A" }, b: { text: "B" } } } as any),
      );
      const rendered = await view;
      assert.deepEqual(probe.a, { text: "A" });
      assert.deepEqual(probe.b, { text: "B" });
      assert.deepEqual(probe.value.modules.notes.slice, {
        a: { text: "A" },
        b: { text: "B" },
      });

      await act(async () =>
        probe.value.modules.notes.set({ notes: { a: { text: "A2" } } }),
      );
      assert.deepEqual(probe.a, { text: "A2" });

      await rendered.unmount();
    });

    test("entries are removed on unmount according to the lifecycle", async () => {
      const notes = createEntriesModule("notes", {
        cleanupDelayMs: 100,
        lifecycle: "graceful",
      });
      const store = { value: null };
      function Page() {
        usePage({ notes: { a: { text: "A" } } } as any);
        return null;
      }
      function Reader() {
        store.value = useRegistryValue("notes", "a") as any;
        return null;
      }
      const view = await render(
        (h as any)(ModuleHost, { modules: [notes] }, h(Page), h(Reader)),
      );
      await view.rerender(
        (h as any)(ModuleHost, { modules: [notes] }, h(Reader)),
      );
      assert.deepEqual(store.value, { text: "A" }, "kept during the delay");
      await act(async () => mock.timers.tick(100));
      assert.equal(store.value, undefined);
      await view.unmount();
    });

    test("page-level registry metadata applies to module entries", async () => {
      const notes = createEntriesModule("notes");
      function StaticPage() {
        usePage({
          notes: { a: { text: "high" } },
          registry: { priority: 500 },
        } as any);
        return null;
      }
      function DynamicPage() {
        usePage({ notes: { a: { text: "default" } } } as any);
        return null;
      }
      let value;
      function Reader() {
        value = useRegistryValue("notes", "a");
        return null;
      }
      const view = await render(
        (h as any)(
          ModuleHost,
          { modules: [notes] },
          h(StaticPage),
          h(DynamicPage),
          h(Reader),
        ),
      );
      assert.deepEqual(value, { text: "high" });
      await view.unmount();
    });

    test("a module's select normalizes the slice before entries", async () => {
      const notes = defineModule({
        id: "notes",
        page: {
          select: (config) =>
            typeof (config as any).notes === "string"
              ? { a: { text: (config as any).notes } }
              : (config as any).notes,
          entries: (slice) =>
            Object.entries(slice).map(([key, value]) => ({ key, value })),
        },
        registry: { keyPolicy: "named", lifecycle: "immediate" },
      });
      const { probe, view } = renderPageWith([notes], () =>
        useModuleRegistration("notes" as any, "shorthand"),
      );
      const rendered = await view;
      assert.deepEqual(probe.a, { text: "shorthand" });
      await rendered.unmount();
    });

    test("a module whose entries throw does not block the others", async (t) => {
      t.mock.method(console, "error", () => {});
      const broken = defineModule({
        id: "broken",
        page: {
          entries: () => {
            throw new Error("boom");
          },
        },
        registry: { keyPolicy: "named", lifecycle: "immediate" },
      });
      const notes = createEntriesModule("notes");
      const { probe, view } = renderPageWith([broken, notes], () =>
        usePage({ broken: { x: {} }, notes: { a: { text: "A" } } } as any),
      );
      const rendered = await view;
      assert.deepEqual(probe.a, { text: "A" });
      assert.equal((console.error as any).mock.callCount(), 1);
      await rendered.unmount();
    });

    test("entries failing the definition's validate are skipped with a warning", async (t) => {
      t.mock.method(console, "warn", () => {});
      const notes = createEntriesModule("notes", {
        validate: (value) =>
          typeof value.text === "string"
            ? { issues: [] as any[], valid: true }
            : { issues: ["text must be a string"], valid: false },
      });
      const { probe, view } = renderPageWith([notes], () =>
        usePage({ notes: { a: { text: 1 }, b: { text: "B" } } } as any),
      );
      const rendered = await view;
      assert.equal(probe.a, undefined);
      assert.deepEqual(probe.b, { text: "B" });
      assert.equal((console.warn as any).mock.callCount(), 1);
      await rendered.unmount();
    });
  });
});

describe("page registration", () => {
  const withTheme = (element) =>
    h(
      ThemeProvider,
      {
        themes: [loadingThemeConfig, ambientThemeConfig, primitivesThemeConfig],
      },
      element,
    );

  async function render(element) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(withTheme(element)));
    return {
      rerender: (next) => act(async () => root.render(withTheme(next))),
      unmount: () => act(async () => root.unmount()),
    };
  }

  function createNamedModule(id) {
    return defineModule({
      id,
      page: {
        entries: (slice) =>
          Object.entries(slice).map(([key, value]) => ({ key, value })),
      },
      registry: { keyPolicy: "named", lifecycle: "immediate" },
    });
  }

  describe("page registration", () => {
    test("a page's module entries reach the registry in one batch", () => {
      const modules = [createNamedModule("first"), createNamedModule("second")];
      const store = createRegistryStore(
        [],
        createModuleRegistryDefinitions(modules as any),
      );
      const seenBySubscriber: any[] = [];
      store.subscribe("first", null, () =>
        seenBySubscriber.push(store.getSnapshot("second", "k")),
      );

      const cleanup = applyRegistryConfig(
        { first: { k: { n: 1 } }, second: { k: { n: 2 } } } as any,
        createRegistryApplyContext(store, {
          instanceId: "page",
          modules: modules as any,
          pathname: "/",
        }),
      );
      assert.deepEqual(
        seenBySubscriber,
        [{ n: 2 }],
        "one notification, with the other module's entry already there",
      );

      cleanup();
      assert.deepEqual(seenBySubscriber, [{ n: 2 }, undefined]);
      assert.equal(store.getSnapshot("first", "k"), undefined);
    });

    test("a registration hook registers what the same usePage slice would", async () => {
      const values: Record<string, any> = {};
      function ReadLoading({ name }) {
        values[name] = useRegistryValue("loading", "page-loading");
        return null;
      }
      function ViaPage() {
        usePage({ loading: "Saving" });
        return null;
      }
      function ViaHook() {
        useLoadingRegistration("Saving");
        return null;
      }

      const page = await render(
        h(
          ModuleHost,
          { modules: [loadingModule] },
          h(ViaPage),
          h(ReadLoading, { name: "page" }),
        ),
      );
      const hook = await render(
        h(
          ModuleHost,
          { modules: [loadingModule] },
          h(ViaHook),
          h(ReadLoading, { name: "hook" }),
        ),
      );
      assert.deepEqual(values.page, { isLoading: true, message: "Saving" });
      assert.deepEqual(values.hook, values.page);
      await page.unmount();
      await hook.unmount();
    });

    test("usePageController reads the active page without registering anything", async () => {
      const seen: Record<string, any> = {};
      function Consumer() {
        seen.consumer = usePageController();
        seen.registered = useRegistryValue("loading", "page-loading");
        return null;
      }
      function Page() {
        seen.page = usePage({ loading: true });
        return null;
      }

      const view = await render(
        h(
          ModuleHost,
          { modules: [loadingModule] },
          h(PageControllerProvider, null, h(Consumer)),
        ),
      );
      assert.equal(seen.registered, undefined, "a consumer registers nothing");
      assert.deepEqual(
        seen.consumer.config,
        {},
        "no page: the inert controller",
      );

      await view.rerender(
        h(
          ModuleHost,
          { modules: [loadingModule] },
          h(PageControllerProvider, null, h(Page), h(Consumer)),
        ),
      );
      assert.equal(
        seen.consumer,
        seen.page,
        "the consumer gets the page's controller",
      );
      assert.deepEqual(seen.registered, { isLoading: true });
      await view.unmount();
    });
  });
});

describe("page runtime", () => {
  const withTheme = (element) =>
    h(
      ThemeProvider,
      {
        themes: [loadingThemeConfig, ambientThemeConfig, primitivesThemeConfig],
      },
      element,
    );

  async function render(element) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(withTheme(element)));
    return { unmount: () => act(async () => root.unmount()) };
  }

  function createProbe(useHook) {
    const probe: { identities: Set<unknown>; latest: any; renders: number } = {
      identities: new Set(),
      latest: undefined,
      renders: 0,
    };
    (probe as any).Component = function Probe() {
      probe.latest = useHook();
      probe.renders += 1;
      probe.identities.add(probe.latest);
      return null;
    };
    return probe;
  }

  const withoutViews = ({ Backdrop, Overlay, ...rest }) => rest;

  function renderPage({
    bridge,
    modules,
    wrap = (children) => children,
    probes = [] as any[],
  }: any) {
    const page = createProbe(() => usePage({ title: "Probe" }));
    const tree = wrap(
      (h as any)(
        PageControllerProvider,
        { runtimeBridge: bridge },
        h((page as any).Component),
        ...probes.map((p) => h((p as any).Component)),
      ),
    );
    const root = modules
      ? h(ModuleHost, { modules: modules.map(withoutViews) }, tree)
      : h(RegistryProvider, null, tree);
    return { page, rendered: render(root) };
  }

  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
  afterEach(() => mock.timers.reset());

  describe("modal: actions are isolated from modal state", () => {
    function Dialog() {
      return null;
    }

    test("usePage and useModalActions do not re-render when modals open or close", async () => {
      const actions = createProbe(useModalActions);
      const state = createProbe(useModalState);
      const { page, rendered } = renderPage({
        modules: [modalModule],
        probes: [actions as any, state as any],
      });
      const view = await rendered;

      await act(async () => {
        (actions.latest! as any).openModal(Dialog);
      });
      assert.equal((state.latest! as any).modalStack.length, 1);
      await act(async () => (actions.latest! as any).closeModal());
      assert.equal((state.latest! as any).modalStack.length, 0);

      assert.equal(page.renders, 1, "the page does not re-render");
      assert.equal(page.identities.size, 1, "the page controller is stable");
      assert.equal(actions.renders, 1);
      assert.equal(actions.identities.size, 1);
      assert.equal(state.renders, 3, "state consumers follow open and close");
      await view.unmount();
    });

    test("useModal(definition) still tracks whether its modal is open", async () => {
      const binding = createProbe(() => useModal(Dialog));
      const view = await render(
        h(ModalProvider, null, h((binding as any).Component)),
      );
      assert.equal((binding.latest! as any).isOpen, false);

      await act(async () => {
        (binding.latest! as any).open({ id: 1 });
      });
      assert.equal((binding.latest! as any).isOpen, true);

      await act(async () => (binding.latest! as any).close());
      assert.equal((binding.latest! as any).isOpen, false);
      await view.unmount();
    });

    test("props passed to a modal are not frozen", async () => {
      const actions = createProbe(useModalActions);
      const state = createProbe(useModalState);
      const view = await render(
        h(
          ModalProvider,
          null,
          h((actions as any).Component),
          h((state as any).Component),
        ),
      );
      const draft = { text: "hello" };
      await act(async () => {
        (actions.latest! as any).openModal(Dialog, { data: { draft } });
      });
      assert.equal((state.latest! as any).modalStack[0].props.draft, draft);
      assert.equal(
        Object.isFrozen(draft),
        false,
        "caller objects stay mutable",
      );
      await view.unmount();
    });
  });

  describe("notification: actions are isolated from toast state", () => {
    test("usePage and useToast do not re-render when toasts appear or expire", async () => {
      const toast = createProbe(() => useToast());
      const actions = createProbe(useNotificationActions);
      const state = createProbe(useNotificationState);
      const { page, rendered } = renderPage({
        modules: [notificationModule],
        probes: [toast as any, actions as any, state as any],
      });
      const view = await rendered;

      await act(async () => {
        toast.latest("Saved", { duration: 1_000 });
      });
      assert.deepEqual(Object.keys((state.latest! as any).notifications), [
        "Saved",
      ]);
      await act(async () => mock.timers.tick(1_000));
      assert.deepEqual((state.latest! as any).notifications, {});

      assert.equal(page.renders, 1, "the page does not re-render");
      assert.equal(page.identities.size, 1, "the page controller is stable");
      assert.equal(toast.renders, 1);
      assert.equal(toast.identities.size, 1, "the toast controller is stable");
      assert.equal(actions.renders, 1);
      assert.equal(state.renders, 3, "state consumers follow show and expire");
      await view.unmount();
    });

    test("usePage({ notification }) sets the page's toast duration", async () => {
      const state = createProbe(useNotificationState);
      const page = createProbe(() => usePage({ notification: 2_000 }));
      const view = await render(
        h(
          ModuleHost,
          { modules: [(withoutViews as any)(notificationModule as any)] },
          h((page as any).Component),
          h((state as any).Component),
        ),
      );
      await act(async () => {
        (page.latest! as any).modules.notification.toast("Saved");
      });
      await act(async () => mock.timers.tick(1_999));
      assert.deepEqual(Object.keys((state.latest! as any).notifications), [
        "Saved",
      ]);
      await act(async () => mock.timers.tick(1));
      assert.deepEqual((state.latest! as any).notifications, {});
      await view.unmount();
    });

    test("toast visibility is readable from the store as toasts come and go", async () => {
      const actions = createProbe(useNotificationActions);
      const state = createProbe(useNotificationState);
      const view = await render(
        h(
          NotificationProvider,
          null,
          h((actions as any).Component),
          h((state as any).Component),
        ),
      );
      const visible = () =>
        Object.keys((state.latest! as any).notifications).length > 0;
      assert.equal(visible(), false);
      await act(async () => {
        (actions.latest! as any).showNotification("Hello", { duration: 500 });
      });
      assert.equal(visible(), true);
      await act(async () => mock.timers.tick(500));
      assert.equal(visible(), false);
      await view.unmount();
    });
  });

  describe("background: actions are isolated from background state", () => {
    test("usePage and useBackgroundActions do not re-render on background changes", async () => {
      const actions = createProbe(useBackgroundActions);
      const state = createProbe(useBackgroundState);
      const { page, rendered } = renderPage({
        modules: [backgroundModule, ambientModule],
        probes: [actions as any, state as any],
      });
      const view = await rendered;

      await act(async () =>
        (actions.latest! as any).setBackground({ color: "#123456" }),
      );
      await act(async () => (actions.latest! as any).setVideoMuted(false));
      await act(async () => (actions.latest! as any).toggleLoop());
      await act(async () => (actions.latest! as any).setVideoPlaying(true));
      assert.equal((state.latest! as any).color, "#123456");
      assert.equal((state.latest! as any).isPlaying, true);

      assert.equal(page.renders, 1, "the page does not re-render");
      assert.equal(page.identities.size, 1, "the page controller is stable");
      assert.equal(actions.renders, 1);
      assert.equal(actions.identities.size, 1);
      assert.equal(state.renders, 5, "state consumers follow every change");
      await view.unmount();
    });

    test("usePage({ background }) normalizes a URL; page.modules.background can replace it", async () => {
      const state = createProbe(useBackgroundState);
      const page = createProbe(() =>
        usePage({ background: "https://youtu.be/dQw4w9WgXcQ" }),
      );
      const view = await render(
        h(
          ModuleHost,
          { modules: [(withoutViews as any)(backgroundModule as any)] },
          h((page as any).Component),
          h((state as any).Component),
        ),
      );
      assert.equal((state.latest! as any).isYouTube, true);
      assert.equal((state.latest! as any).youtubeVideoId, "dQw4w9WgXcQ");
      assert.equal(
        (state.latest! as any).posterUrl,
        "/api/background/youtube?id=dQw4w9WgXcQ&stream=thumbnail",
      );

      await act(async () =>
        (page.latest! as any).modules.background.set({ color: "#101010" }),
      );
      assert.equal((state.latest! as any).isYouTube, false);
      assert.equal((state.latest! as any).color, "#101010");
      await view.unmount();
    });
  });

  describe("loading: actions are isolated from loading state", () => {
    async function mountLoading(extra: any[] = []) {
      const actions = createProbe(useLoadingActions);
      const state = createProbe(useLoadingState);
      const view = await render(
        h(
          ModuleHost,
          { modules: [loadingModule] },
          h((actions as any).Component),
          h((state as any).Component),
          ...extra,
        ),
      );
      return { actions, state, view };
    }

    test("useLoadingActions consumers do not re-render when loading starts or stops", async () => {
      const { actions, state, view } = await mountLoading();
      await act(async () =>
        (actions.latest! as any).startLoading({ message: "Saving" }),
      );
      assert.equal((state.latest! as any).isLoading, true);
      assert.equal((state.latest! as any).message, "Saving");
      await act(async () => (actions.latest! as any).stopLoading());
      assert.equal((state.latest! as any).isLoading, false);

      assert.equal(actions.renders, 1);
      assert.equal(actions.identities.size, 1);
      assert.equal(state.renders, 3);
      await view.unmount();
    });

    test("minDuration keeps loading visible until it has elapsed", async () => {
      mock.timers.reset();
      mock.timers.enable({ apis: ["setTimeout", "Date"] });
      const { actions, state, view } = await mountLoading();
      await act(async () =>
        (actions.latest! as any).startLoading({ minDuration: 500 }),
      );
      await act(async () => mock.timers.tick(100));
      await act(async () => (actions.latest! as any).stopLoading());
      assert.equal((state.latest! as any).isLoading, true);
      await act(async () => mock.timers.tick(400));
      assert.equal((state.latest! as any).isLoading, false);
      await view.unmount();
    });

    test("page loading from the registry wins over manual loading", async () => {
      function PageLoading() {
        useLoadingRegistration({ isLoading: true, message: "Page" });
        return null;
      }
      const { state, view } = await mountLoading([h(PageLoading) as any]);
      assert.equal((state.latest! as any).isPageLoading, true);
      assert.equal((state.latest! as any).message, "Page");
      await view.unmount();
    });

    test("usePage({ loading }) sets page loading; page.modules.loading can change it", async () => {
      const page = createProbe(() => usePage({ loading: "Fetching" }));
      const { actions, state, view } = await mountLoading([
        h((page as any).Component) as any,
      ]);
      assert.equal((state.latest! as any).isPageLoading, true);
      assert.equal((state.latest! as any).message, "Fetching");
      assert.equal(
        (page.latest! as any).modules.loading.startLoading,
        (actions.latest! as any).startLoading,
        "the page API carries the module's actions",
      );

      await act(async () => (page.latest! as any).modules.loading.set(false));
      assert.equal((state.latest! as any).isPageLoading, false);
      await view.unmount();
    });
  });

  describe("context menu: actions are isolated from menu state", () => {
    async function mountMenu() {
      const actions = createProbe(useContextMenuActions);
      const state = createProbe(useContextMenuState);
      const api = createProbe(() => useContextMenu());
      const view = await render(
        h(
          RegistryProvider,
          null,
          h(
            ContextMenuProvider,
            null,
            h((actions as any).Component),
            h((state as any).Component),
            h((api as any).Component),
          ),
        ),
      );
      return { actions, api, state, view };
    }

    const fakeContextMenuEvent = () => ({
      clientX: 12,
      clientY: 34,
      currentTarget: null,
      preventDefault() {},
      stopPropagation() {},
      target: null,
    });

    test("useContextMenuActions consumers do not re-render when the menu opens or closes", async () => {
      const { actions, state, view } = await mountMenu();
      await act(async () =>
        (actions.latest! as any).openMenu({
          config: { items: [] as any[] },
          items: [{ key: "a", label: "A" }],
          position: { x: 1, y: 2 },
        }),
      );
      assert.equal((state.latest! as any).isOpen, true);
      assert.deepEqual((state.latest! as any).position, { x: 1, y: 2 });
      await act(async () => (actions.latest! as any).closeMenu());
      assert.equal((state.latest! as any).isOpen, false);

      assert.equal(actions.renders, 1);
      assert.equal(actions.identities.size, 1);
      assert.equal(state.renders, 3);
      await view.unmount();
    });

    test("bind opens a menu with resolved items and is stable across menu state", async () => {
      const { api, state, view } = await mountMenu();
      const bind = (api.latest! as any).bind;
      const closed: any[] = [];
      const config = {
        items: [{ key: "copy", label: "Copy" }],
        onClose: (context) => closed.push(context.payload),
      };

      await act(async () =>
        (api.latest! as any)
          .bind({ id: 7 }, config)
          .onContextMenu(fakeContextMenuEvent()),
      );
      assert.equal((state.latest! as any).isOpen, true);
      assert.deepEqual((state.latest! as any).position, { x: 12, y: 34 });
      assert.deepEqual(
        (state.latest! as any).items.map((item) => item.label),
        ["Copy"],
      );
      assert.deepEqual((state.latest! as any).context.payload, { id: 7 });
      assert.equal((api.latest! as any).bind, bind, "bind keeps its identity");

      await act(async () => (api.latest! as any).closeMenu());
      assert.deepEqual(
        closed,
        [{ id: 7 }],
        "onClose receives the menu context",
      );
      await view.unmount();
    });

    test("visibility is announced on mount, open and close", async () => {
      const events: any[] = [];
      const listener = (event) => events.push(event.detail.isOpen);
      window.addEventListener(CONTEXT_MENU_VISIBILITY_EVENT, listener);
      const { actions, view } = await mountMenu();
      await act(async () =>
        (actions.latest! as any).openMenu({
          config: { items: [] as any[] },
          items: [{ key: "a", label: "A" }],
        }),
      );
      await act(async () => (actions.latest! as any).closeMenu());
      window.removeEventListener(CONTEXT_MENU_VISIBILITY_EVENT, listener);
      assert.deepEqual(events, [false, true, false]);
      await view.unmount();
    });
    test("usePage({ contextMenu }) registers the menu for the current route", async () => {
      const actions = createProbe(useContextMenuActions);
      const menu = { items: [{ key: "copy", label: "Copy" }] };
      const registered = createProbe(() =>
        useRegistryValue("contextMenu", navigationTestState.pathname),
      );
      const page = createProbe(() => usePage({ contextMenu: menu }));
      const view = await render(
        h(
          ModuleHost,
          { modules: [(withoutViews as any)(contextMenuModule as any)] },
          h((page as any).Component),
          h((actions as any).Component),
          h((registered as any).Component),
        ),
      );
      assert.deepEqual(registered.latest, menu);
      assert.equal(
        (page.latest! as any).modules.contextMenu.openMenu,
        (actions.latest! as any).openMenu,
      );
      await view.unmount();
    });
  });

  describe("ambient: theme users are isolated from the shared palette", () => {
    const PAGE_PALETTE = { black: "#000000", primary: "#112233" };

    test("usePage does not re-render when the shared palette changes", async () => {
      const ambient = createProbe(() => useAmbient());
      const { page, rendered } = renderPage({
        modules: [ambientModule, backgroundModule],
        probes: [ambient as any],
      });
      const view = await rendered;

      await act(async () =>
        (ambient.latest! as any).setPalette({
          black: "#010101",
          primary: "#abcdef",
        }),
      );
      await act(async () => (ambient.latest! as any).setIsExtracting(true));
      assert.equal((ambient.latest! as any).palette.primary, "#abcdef");
      assert.equal((ambient.latest! as any).isExtracting, true);

      assert.equal(page.renders, 1, "the page does not re-render");
      assert.equal(page.identities.size, 1, "the page controller is stable");
      await view.unmount();
    });

    test("a page's theme reaches the provider without re-rendering the page", async () => {
      const ambient = createProbe(() => useAmbient());
      const themed = createProbe(() =>
        useAmbientTheme({
          colors: { primary: PAGE_PALETTE.primary },
          initialPalette: PAGE_PALETTE,
          transition: false,
        }),
      );
      const view = await render(
        h(
          AmbientProvider,
          null,
          h((themed as any).Component),
          h((ambient as any).Component),
        ),
      );
      assert.deepEqual(
        [
          (ambient.latest! as any).palette.primary,
          (ambient.latest! as any).palette.black,
        ],
        [PAGE_PALETTE.primary, PAGE_PALETTE.black],
      );
      assert.equal(themed.renders, 1, "the theme user renders once");
      await view.unmount();
    });

    test("setPalette accepts an updater; returning the same palette is a no-op", async () => {
      const ambient = createProbe(() => useAmbient());
      const view = await render(
        h(AmbientProvider, null, h((ambient as any).Component)),
      );
      await act(async () =>
        (ambient.latest! as any).setPalette((prev) => ({
          ...prev,
          primary: "#fedcba",
        })),
      );
      assert.equal((ambient.latest! as any).palette.primary, "#fedcba");

      const renders = ambient.renders;
      await act(async () =>
        (ambient.latest! as any).setPalette((prev) => prev),
      );
      assert.equal(ambient.renders, renders);
      await view.unmount();
    });
  });
});

describe("registry cleanup", () => {
  const createRegistryStore = createRegistryStore__4;
  const createRegistryApplyContext = createRegistryApplyContext__4;

  function applyRegistryConfig(config, context) {
    return applyPayload(
      { ...config, ...createModulePayload(builtInModules as any, config) },
      context,
    );
  }

  function createApplyContext(
    store,
    { instanceId = "page-1", pathname = "/page" } = {},
  ) {
    return createRegistryApplyContext(store, {
      instanceId,
      modules: builtInModules as any,
      pathname,
    });
  }

  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
  afterEach(() => mock.timers.reset());

  describe("registry cleanup lifecycles", () => {
    test("route lifecycle (dock default) keeps the value for 600ms after unmount", () => {
      const store = createRegistryStore();
      const cleanup = applyRegistryConfig(
        { dock: { title: "Page" } },
        createApplyContext(store),
      );
      assert.equal((store.getSnapshot("dock", "/page") as any).title, "Page");

      cleanup();
      mock.timers.tick(599);
      assert.equal((store.getSnapshot("dock", "/page") as any).title, "Page");
      mock.timers.tick(1);
      assert.equal(store.getSnapshot("dock", "/page"), undefined);
    });

    test("re-applying before the delay cancels the pending cleanup", () => {
      const store = createRegistryStore();
      const context = createApplyContext(store);
      const cleanup = applyRegistryConfig({ dock: { title: "Page" } }, context);

      cleanup();
      mock.timers.tick(300);
      applyRegistryConfig({ dock: { title: "Page again" } }, context);
      mock.timers.tick(1_000);
      assert.equal(
        (store.getSnapshot("dock", "/page") as any).title,
        "Page again",
      );
    });

    test("immediate lifecycle (background default) removes synchronously", () => {
      const store = createRegistryStore();
      const cleanup = applyRegistryConfig(
        { background: { color: "#000" } },
        createApplyContext(store),
      );
      assert.deepEqual(store.getSnapshot("background", "page-background"), {
        color: "#000",
      });
      cleanup();
      assert.equal(
        store.getSnapshot("background", "page-background"),
        undefined,
      );
    });

    test("immediate lifecycle ignores the definition's 600ms default delay", () => {
      const store = createRegistryStore();
      const cleanup = applyRegistryConfig(
        { modal: { confirm: () => null } },
        createApplyContext(store),
      );
      cleanup();
      assert.equal(store.getSnapshot("modal", "confirm"), undefined);
    });

    test("an explicit cleanupDelayMs is honored", () => {
      const store = createRegistryStore();
      const cleanup = applyRegistryConfig(
        { dock: { title: "Page", registry: { cleanupDelayMs: 50 } } },
        createApplyContext(store),
      );
      cleanup();
      mock.timers.tick(49);
      assert.ok(store.getSnapshot("dock", "/page"));
      mock.timers.tick(1);
      assert.equal(store.getSnapshot("dock", "/page"), undefined);
    });

    test("persistent lifecycle survives cleanup", () => {
      const store = createRegistryStore();
      const cleanup = applyRegistryConfig(
        {
          background: { color: "#111", registry: { lifecycle: "persistent" } },
        },
        createApplyContext(store),
      );
      cleanup();
      mock.timers.tick(10_000);
      assert.deepEqual(store.getSnapshot("background", "page-background"), {
        color: "#111",
      });
    });

    test("cleanup of one page instance does not remove another instance's value", () => {
      const store = createRegistryStore();
      const cleanupA = applyRegistryConfig(
        { modal: { shared: () => "a" } },
        createApplyContext(store, { instanceId: "a" }),
      );
      applyRegistryConfig(
        { modal: { shared: () => "b" } },
        createApplyContext(store, { instanceId: "b" }),
      );
      cleanupA();
      assert.equal((store.getSnapshot("modal", "shared") as any)(), "b");
    });
  });

  describe("registry handlers: page config mapping", () => {
    test("dock registers under config.path, falling back to the current pathname", () => {
      const store = createRegistryStore();
      applyRegistryConfig(
        { dock: { title: "A" } },
        createApplyContext(store, { pathname: "/a" }),
      );
      applyRegistryConfig(
        { dock: { title: "B", path: "/explicit" } },
        createApplyContext(store, { instanceId: "p2", pathname: "/b" }),
      );
      assert.equal((store.getSnapshot("dock", "/a") as any).title, "A");
      assert.equal((store.getSnapshot("dock", "/explicit") as any).title, "B");
      assert.equal(store.getSnapshot("dock", "/b"), undefined);
    });

    test("dock inherits isLoading from the page's loading block", () => {
      const store = createRegistryStore();
      applyRegistryConfig(
        { dock: { title: "A" }, loading: { isLoading: true } },
        createApplyContext(store),
      );
      assert.equal((store.getSnapshot("dock", "/page") as any).isLoading, true);
    });

    test("invalid dock config is not registered", (t) => {
      t.mock.method(console, "warn", () => {});
      const store = createRegistryStore();
      applyRegistryConfig(
        { dock: { width: "wide" } },
        createApplyContext(store),
      );
      assert.equal(store.getSnapshot("dock", "/page"), undefined);
      assert.equal((console.warn as any).mock.callCount(), 1);
    });

    test("strict registry metadata that is invalid blocks the registration", () => {
      const store = createRegistryStore();
      applyRegistryConfig(
        {
          background: {
            color: "#000",
            registry: { validation: "strict", bogus: 1 },
          },
        },
        createApplyContext(store),
      );
      assert.equal(
        store.getSnapshot("background", "page-background"),
        undefined,
      );
    });

    test("left/right controls expand into two entries keyed by path and side", () => {
      const store = createRegistryStore();
      applyRegistryConfig(
        { controls: { left: "L", right: "R" } },
        createApplyContext(store),
      );
      const entries = store.getEntriesSnapshot("controls");
      assert.deepEqual(Object.keys(entries).sort(), [
        "/page::controls-left",
        "/page::controls-right",
      ]);
      assert.equal((entries["/page::controls-left"] as any).side, "left");
      assert.equal((entries["/page::controls-right"] as any).content, "R");
    });

    test("multiple modals register in one batch and clean up together", () => {
      const store = createRegistryStore();
      let notifications = 0;
      store.subscribe("modal", null, () => (notifications += 1));
      const cleanup = applyRegistryConfig(
        { modal: { a: () => null, b: () => null } },
        createApplyContext(store),
      );
      assert.equal(notifications, 1);
      cleanup();
      assert.deepEqual(store.getEntriesSnapshot("modal"), {});
    });
  });
});

describe("registry operations", () => {
  const {
    applyOperation,
    createInitialRegistries,
    createResolverCache,
    hasOperationEffect,
    resolveEffectiveOperations,
    resolveEntryValue,
  } = registryOperations;

  let sequence = 0;

  function register(state, type, key, value, sourceOrOptions, options) {
    sequence += 1;
    return applyOperation(
      state,
      createRegisterOperation(
        type,
        key,
        value,
        sourceOrOptions,
        options,
        1_000 + sequence,
        sequence,
      ),
    );
  }

  function unregister(state, type, key, sourceOrOptions) {
    return applyOperation(
      state,
      createUnregisterOperation(type, key, sourceOrOptions),
    );
  }

  function resolve(state, type, key, scope = null) {
    return resolveEntryValue(type, state[type]?.[key], scope);
  }

  describe("registry operations: record identity", () => {
    test("record keys separate source, instance and scope", () => {
      const keys = new Set([
        createRecordKey("dynamic"),
        createRecordKey("static"),
        createRecordKey("dynamic", "a"),
        createRecordKey("dynamic", "b"),
        createRecordKey("dynamic", "a", "workspace"),
        createRecordKey("dynamic", null, "workspace"),
      ]);
      assert.equal(keys.size, 6);
    });

    test("register operation defaults: dynamic source, app scope, trimmed key", () => {
      const op = createRegisterOperation(
        "dock",
        "  /home ",
        { a: 1 },
        undefined,
        undefined,
        1,
        1,
      );
      assert.equal(op.source, "dynamic");
      assert.equal(op.scope, "app");
      assert.equal(op.key, "/home");
      assert.equal(op.instanceId, null);
      assert.equal(op.record.priority, 200);
    });

    test("source priority defaults are static < dynamic < user; explicit priority wins", () => {
      const priorityOf = (sourceOrOptions, options) =>
        createRegisterOperation("dock", "/", {}, sourceOrOptions, options, 1, 1)
          .record.priority;
      assert.equal((priorityOf as any)("static"), 100);
      assert.equal((priorityOf as any)("dynamic"), 200);
      assert.equal((priorityOf as any)("user"), 300);
      assert.equal(priorityOf("static", { priority: 999 }), 999);
      assert.equal((priorityOf as any)({ source: "user", priority: 5 }), 5);
      assert.equal((priorityOf as any)("custom-source"), 0);
    });
  });

  describe("registry operations: priority resolver", () => {
    test("higher source priority wins regardless of registration order", () => {
      let state = createInitialRegistries();
      state = (register as any)(
        state,
        "modal",
        "confirm",
        { v: "user" },
        "user",
      );
      state = (register as any)(
        state,
        "modal",
        "confirm",
        { v: "static" },
        "static",
      );
      state = (register as any)(
        state,
        "modal",
        "confirm",
        { v: "dynamic" },
        "dynamic",
      );
      assert.deepEqual(resolve(state, "modal", "confirm"), { v: "user" });
    });

    test("explicit priority overrides source ordering", () => {
      let state = createInitialRegistries();
      state = (register as any)(state, "modal", "m", { v: "user" }, "user");
      state = register(state, "modal", "m", { v: "static" }, "static", {
        priority: 1_000,
      });
      assert.deepEqual(resolve(state, "modal", "m"), { v: "static" });
    });

    test("equal priority falls back to source rank, then to the latest registration", () => {
      let state = createInitialRegistries();
      state = register(state, "modal", "m", { v: "user" }, "user", {
        priority: 50,
      });
      state = register(state, "modal", "m", { v: "static" }, "static", {
        priority: 50,
      });
      assert.deepEqual(
        resolve(state, "modal", "m"),
        { v: "user" },
        "rank breaks the tie",
      );

      state = register(state, "modal", "m", { v: "first" }, "dynamic", {
        instanceId: "a",
        priority: 70,
      });
      state = register(state, "modal", "m", { v: "second" }, "dynamic", {
        instanceId: "b",
        priority: 70,
      });
      assert.deepEqual(
        resolve(state, "modal", "m"),
        { v: "second" },
        "sequence breaks the tie",
      );
    });

    test("removing the winner falls back to the next record", () => {
      let state = createInitialRegistries();
      state = (register as any)(state, "modal", "m", { v: "static" }, "static");
      state = (register as any)(state, "modal", "m", { v: "user" }, "user");
      state = unregister(state, "modal", "m", "user");
      assert.deepEqual(resolve(state, "modal", "m"), { v: "static" });
    });
  });

  describe("registry operations: merge resolver (DOCK)", () => {
    test("merges records lowest priority first so higher priority fields win", () => {
      let state = createInitialRegistries();
      state = (register as any)(
        state,
        "dock",
        "/p",
        { title: "Static", icon: "a", path: "/p" },
        "static",
      );
      state = (register as any)(
        state,
        "dock",
        "/p",
        { title: "Dynamic", path: "/p" },
        "dynamic",
      );
      assert.deepEqual(resolve(state, "dock", "/p"), {
        icon: "a",
        path: "/p",
        title: "Dynamic",
      });
    });

    test("style sections are merged one level deep instead of replaced", () => {
      let state = createInitialRegistries();
      state = (register as any)(
        state,
        "dock",
        "/p",
        {
          style: { card: { className: "base", opacity: 1 }, icon: { size: 4 } },
        },
        "static",
      );
      state = (register as any)(
        state,
        "dock",
        "/p",
        {
          style: { card: { className: "override" } },
        },
        "dynamic",
      );
      assert.deepEqual((resolve(state, "dock", "/p") as any).style, {
        card: { className: "override", opacity: 1 },
        icon: { size: 4 },
      });
    });
  });

  describe("registry operations: instances and scopes", () => {
    test("instances of the same source coexist; unregister by instance removes only that one", () => {
      let state = createInitialRegistries();
      state = register(state, "modal", "m", { v: "a" }, "dynamic", {
        instanceId: "a",
      });
      state = register(state, "modal", "m", { v: "b" }, "dynamic", {
        instanceId: "b",
      });
      assert.equal(Object.keys(state.modal.m).length, 2);

      state = unregister(state, "modal", "m", {
        source: "dynamic",
        instanceId: "b",
      });
      assert.deepEqual(resolve(state, "modal", "m"), { v: "a" });
    });

    test("unregister by source alone removes every instance of that source", () => {
      let state = createInitialRegistries();
      state = register(state, "modal", "m", { v: "a" }, "dynamic", {
        instanceId: "a",
      });
      state = register(state, "modal", "m", { v: "b" }, "dynamic", {
        instanceId: "b",
      });
      state = (register as any)(state, "modal", "m", { v: "s" }, "static");
      state = unregister(state, "modal", "m", "dynamic");
      assert.deepEqual(resolve(state, "modal", "m"), { v: "s" });
    });

    test("removing the last record deletes the key", () => {
      let state = createInitialRegistries();
      state = (register as any)(state, "modal", "m", { v: 1 }, "dynamic");
      state = unregister(state, "modal", "m", "dynamic");
      assert.equal(Object.hasOwn(state.modal, "m"), false);
    });

    test("scoped resolution only sees records of that scope", () => {
      let state = createInitialRegistries();
      state = (register as any)(state, "modal", "m", { v: "app" }, "user");
      state = register(state, "modal", "m", { v: "ws" }, "static", {
        scope: "workspace",
      });
      assert.deepEqual(resolve(state, "modal", "m"), { v: "app" });
      assert.deepEqual(resolve(state, "modal", "m", "workspace" as any), {
        v: "ws",
      });
      assert.equal(resolve(state, "modal", "m", "session" as any), undefined);
    });
  });

  describe("registry operations: no-op detection and targets", () => {
    test("re-registering a shallow-equal value is not an effect and keeps state identity", () => {
      let state = createInitialRegistries();
      state = (register as any)(
        state,
        "modal",
        "m",
        { a: 1, b: "x" },
        "dynamic",
      );
      const op = createRegisterOperation(
        "modal",
        "m",
        { a: 1, b: "x" },
        "dynamic",
        {},
        9,
        9_999,
      );
      assert.equal(hasOperationEffect(state, op), false);
      assert.equal(applyOperation(state, op), state);
    });

    test("changed value or priority is an effect", () => {
      let state = createInitialRegistries();
      state = (register as any)(state, "modal", "m", { a: 1 }, "dynamic");
      const changedValue = createRegisterOperation(
        "modal",
        "m",
        { a: 2 },
        "dynamic",
        {},
        9,
        9_999,
      );
      const changedPriority = createRegisterOperation(
        "modal",
        "m",
        { a: 1 },
        "dynamic",
        { priority: 1 },
        9,
        9_999,
      );
      assert.equal(hasOperationEffect(state, changedValue), true);
      assert.equal(hasOperationEffect(state, changedPriority), true);
    });

    test("unregistering something absent is not an effect", () => {
      const state = createInitialRegistries();
      const op = createUnregisterOperation("modal", "missing", "dynamic");
      assert.equal(hasOperationEffect(state, op), false);
      assert.equal(applyOperation(state, op), state);
    });

    test("invalid targets are ignored: unknown type, empty key, key policy violations", () => {
      const state = createInitialRegistries();
      for (const [type, key] of [
        ["NOT_A_TYPE", "x"],
        ["modal", "   "],
        ["dock", "relative/path"],
        ["background", "not-the-singleton-key"],
        ["contextMenu", "not-a-route"],
      ]) {
        const op = createRegisterOperation(type, key, {}, "dynamic", {}, 1, 1);
        assert.equal(applyOperation(state, op), state, `${type}:${key}`);
      }
    });

    test("valid key policies: path, singleton, route and reserved route keys", () => {
      let state = createInitialRegistries();
      state = (register as any)(state, "dock", "/a", {}, "dynamic");
      state = (register as any)(
        state,
        "background",
        "page-background",
        {},
        "dynamic",
      );
      state = (register as any)(state, "contextMenu", "/a", {}, "dynamic");
      state = (register as any)(
        state,
        "contextMenu",
        "current-page",
        {},
        "dynamic",
      );
      assert.ok(state.dock["/a"]);
      assert.ok(state.background["page-background"]);
      assert.ok(state.contextMenu["/a"]);
      assert.ok(state.contextMenu["current-page"]);
    });
  });

  describe("registry operations: batches and caching", () => {
    test("resolveEffectiveOperations applies in order and drops no-ops", () => {
      const state = createInitialRegistries();
      const ops = [
        createRegisterOperation("modal", "a", { v: 1 }, "dynamic", {}, 1, 1),
        createRegisterOperation("modal", "a", { v: 1 }, "dynamic", {}, 2, 2),
        createRegisterOperation("modal", "b", { v: 2 }, "dynamic", {}, 3, 3),
        createUnregisterOperation("modal", "b", "dynamic"),
        createUnregisterOperation("modal", "never", "dynamic"),
      ];
      const { effectiveOperations, nextState } = resolveEffectiveOperations(
        state,
        ops,
      );
      assert.deepEqual(effectiveOperations, [ops[0], ops[2], ops[3]]);
      assert.deepEqual(Object.keys(nextState.modal), ["a"]);
      assert.deepEqual(
        Object.keys(state.modal),
        [],
        "input state is not mutated",
      );
    });

    test("resolver cache returns the same value object for the same entry", () => {
      let state = createInitialRegistries();
      state = (register as any)(state, "dock", "/p", { title: "a" }, "static");
      state = (register as any)(state, "dock", "/p", { icon: "b" }, "dynamic");
      const resolveCached = createResolverCache();

      const first = resolveCached("dock", state.dock["/p"]);
      assert.equal(resolveCached("dock", state.dock["/p"]), first);

      state = (register as any)(state, "dock", "/p", { icon: "c" }, "dynamic");
      const next = resolveCached("dock", state.dock["/p"]);
      assert.notEqual(next, first);
      assert.deepEqual(next, { icon: "c", title: "a" });
    });
  });
});

describe("registry store", () => {
  const createRegistryStore = createRegistryStore__6;

  function countNotifications(store, type, key) {
    const calls = { count: 0 };
    store.subscribe(type, key, () => {
      calls.count += 1;
    });
    return calls;
  }

  describe("registry store: registration handles", () => {
    test("register exposes the value and returns an active handle", () => {
      const store = createRegistryStore();
      const handle = store.register("modal", "confirm", { title: "Sure?" });
      assert.equal(handle.status, "active");
      assert.equal(handle.active, true);
      assert.equal(handle.source, "dynamic");
      assert.deepEqual(store.getSnapshot("modal", "confirm"), {
        title: "Sure?",
      });
    });

    test("dispose removes the value once; later calls are no-ops", () => {
      const store = createRegistryStore();
      const handle = store.register("modal", "confirm", { title: "Sure?" });
      assert.equal(handle.dispose(), true);
      assert.equal(handle.status, "disposed");
      assert.equal(store.getSnapshot("modal", "confirm"), undefined);
      assert.equal(handle.dispose(), false);
      assert.equal(handle(), false, "the handle is callable as dispose");
    });

    test("a newer registration from the same owner supersedes the old handle", () => {
      const store = createRegistryStore();
      const first = store.register(
        "modal",
        "m",
        { v: 1 },
        { instanceId: "page" },
      );
      const second = store.register(
        "modal",
        "m",
        { v: 2 },
        { instanceId: "page" },
      );
      assert.equal(first.status, "superseded");
      assert.equal(second.status, "active");

      assert.equal(
        first.dispose(),
        false,
        "disposing a superseded handle reports that nothing was removed",
      );
      assert.deepEqual(
        store.getSnapshot("modal", "m"),
        { v: 2 },
        "a stale handle cannot remove the newer value",
      );
      assert.equal(second.status, "active");
    });

    test("update re-registers under the same owner and returns the new handle", () => {
      const store = createRegistryStore();
      const handle = store.register("modal", "m", { v: 1 }, "user", {
        priority: 7,
      });
      const next = handle.update({ v: 2 });
      assert.notEqual(next, handle);
      assert.equal(next.priority, 7);
      assert.equal(next.source, "user");
      assert.deepEqual(store.getSnapshot("modal", "m"), { v: 2 });
      assert.equal(
        handle.update({ v: 3 }).status,
        "rejected",
        "a used handle cannot update again",
      );
    });

    test("registering an unchanged value is ignored", () => {
      const store = createRegistryStore();
      store.register("modal", "m", { v: 1 });
      const calls = countNotifications(store, "modal", "m");
      const handle = store.register("modal", "m", { v: 1 });
      assert.equal(handle.status, "ignored");
      assert.equal(calls.count, 0);
    });

    test("stored values are copies: mutating the input later does not leak in", () => {
      const store = createRegistryStore();
      const input = { nested: { title: "a" }, list: [1] };
      store.register("modal", "m", input);
      input.nested.title = "mutated";
      input.list.push(2);
      assert.deepEqual(store.getSnapshot("modal", "m"), {
        nested: { title: "a" },
        list: [1],
      });
    });
  });

  describe("registry store: validation", () => {
    test("invalid targets are rejected", () => {
      const store = createRegistryStore();
      assert.equal(store.register("NOPE", "x", {}).status, "rejected");
      assert.equal(store.register("dock", "no-slash", {}).status, "rejected");
      assert.equal(store.getSnapshot("dock", "no-slash"), undefined);
    });

    test("strict validation rejects invalid values", () => {
      const store = createRegistryStore();
      const handle = store.register(
        "dock",
        "/p",
        { width: "wide" },
        { validation: "strict" },
      );
      assert.equal(handle.status, "rejected");
      assert.equal(handle.reason, "invalid-value");
      assert.equal(store.getSnapshot("dock", "/p"), undefined);
    });

    test("CURRENT BEHAVIOR: default (warn) validation stores invalid values silently", () => {
      const store = createRegistryStore();
      const handle = store.register("dock", "/p", { width: "wide" });
      assert.equal(handle.status, "active");
      assert.deepEqual(store.getSnapshot("dock", "/p"), { width: "wide" });
    });
  });

  describe("registry store: subscriptions and snapshots", () => {
    test("key listeners only fire for their key; type listeners fire for any key", () => {
      const store = createRegistryStore();
      const a = countNotifications(store, "modal", "a");
      const b = countNotifications(store, "modal", "b");
      const type = countNotifications(store, "modal", null);
      const other = countNotifications(store, "dock", null);

      store.register("modal", "a", { v: 1 });
      assert.deepEqual(
        [a.count, b.count, type.count, other.count],
        [1, 0, 1, 0],
      );

      store.unregister("modal", "a");
      assert.deepEqual(
        [a.count, b.count, type.count, other.count],
        [2, 0, 2, 0],
      );
    });

    test("unsubscribe stops notifications", () => {
      const store = createRegistryStore();
      let count = 0;
      const unsubscribe = store.subscribe("modal", "a", () => (count += 1));
      unsubscribe();
      store.register("modal", "a", { v: 1 });
      assert.equal(count, 0);
    });

    test("a throwing listener does not block other listeners", () => {
      const store = createRegistryStore();
      let reached = false;
      store.subscribe("modal", "a", () => {
        throw new Error("boom");
      });
      store.subscribe("modal", "a", () => (reached = true));
      store.register("modal", "a", { v: 1 });
      assert.equal(reached, true);
    });

    test("value snapshots keep identity until their own key changes", () => {
      const store = createRegistryStore();
      store.register("modal", "a", { v: 1 });
      const snapshot = store.getSnapshot("modal", "a");
      assert.equal(store.getSnapshot("modal", "a"), snapshot);

      store.register("modal", "b", { v: 2 });
      assert.equal(
        store.getSnapshot("modal", "a"),
        snapshot,
        "unrelated key keeps identity",
      );

      store.register("modal", "a", { v: 3 });
      assert.notEqual(store.getSnapshot("modal", "a"), snapshot);
    });

    test("entries snapshot is frozen and stable until the type changes", () => {
      const store = createRegistryStore();
      store.register("modal", "a", { v: 1 });
      const entries = store.getEntriesSnapshot("modal");
      assert.ok(Object.isFrozen(entries));
      assert.deepEqual(entries, { a: { v: 1 } });
      assert.equal(store.getEntriesSnapshot("modal"), entries);

      store.register("dock", "/p", {});
      assert.equal(
        store.getEntriesSnapshot("modal"),
        entries,
        "other types do not invalidate",
      );

      store.register("modal", "b", { v: 2 });
      assert.deepEqual(store.getEntriesSnapshot("modal"), {
        a: { v: 1 },
        b: { v: 2 },
      });
    });
  });

  describe("registry store: batches, initial entries, transactions", () => {
    test("batch commits once and notifies each changed key once", () => {
      const store = createRegistryStore();
      const a = countNotifications(store, "modal", "a");
      const type = countNotifications(store, "modal", null);

      const applied = store.batch((queue) => {
        queue.register("modal", "a", { v: 1 });
        queue.register("modal", "a", { v: 2 });
        queue.register("modal", "b", { v: 1 });
        queue.unregister("modal", "missing");
      });

      assert.equal(applied, 3);
      assert.equal(a.count, 1);
      assert.equal(type.count, 1);
      assert.deepEqual(store.getSnapshot("modal", "a"), { v: 2 });
    });

    test("a batch whose net effect on a key is nothing does not notify that key", () => {
      const store = createRegistryStore();
      const a = countNotifications(store, "modal", "a");
      const type = countNotifications(store, "modal", null);
      store.batch((queue) => {
        queue.register("modal", "a", { v: 1 });
        queue.unregister("modal", "a");
      });
      assert.equal(a.count, 0);
      assert.equal(type.count, 0);
    });

    test("initial entries register as static and are overridden by dynamic ones", () => {
      const store = createRegistryStore([
        { type: "modal", items: { m: { v: "static" } } } as any,
      ]);
      assert.deepEqual(store.getSnapshot("modal", "m"), { v: "static" });

      const handle = store.register("modal", "m", { v: "dynamic" });
      assert.deepEqual(store.getSnapshot("modal", "m"), { v: "dynamic" });

      handle.dispose();
      assert.deepEqual(
        store.getSnapshot("modal", "m"),
        { v: "static" },
        "falls back to static",
      );
    });

    test("initial entries that fail validation are skipped", () => {
      const store = createRegistryStore([
        { type: "dock", items: { "no-slash": {}, "/ok": {} } } as any,
      ]);
      assert.equal(store.getSnapshot("dock", "no-slash"), undefined);
      assert.deepEqual(store.getSnapshot("dock", "/ok"), {});
    });

    test("transaction applies all operations together", () => {
      const store = createRegistryStore();
      const type = countNotifications(store, "modal", null);
      const result = store.transaction((tx) => {
        tx.register("modal", "a", { v: 1 });
        tx.register("modal", "b", { v: 2 });
      });
      assert.equal(result.status, "committed");
      assert.equal(result.applied, 2);
      assert.equal(type.count, 1);
    });

    test("a throwing transaction applies nothing and rethrows", () => {
      const store = createRegistryStore();
      assert.throws(
        () =>
          store.transaction((tx) => {
            tx.register("modal", "a", { v: 1 });
            throw new Error("abort");
          }),
        /abort/,
      );
      assert.equal(store.getSnapshot("modal", "a"), undefined);
    });
  });
});
