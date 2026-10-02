import "./dom.ts";
import { afterEach } from "node:test";
import {
  act,
  createElement as h,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";

const mounted = new Set<() => Promise<void>>();

afterEach(async () => {
  for (const unmount of [...mounted]) await unmount();
});

export interface MountedView {
  container: HTMLElement;
  rerender: (next: ReactNode) => Promise<void>;
  unmount: () => Promise<void>;
}

export async function render(element: ReactNode): Promise<MountedView> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));

  let active = true;
  const unmount = async () => {
    if (!active) return;
    active = false;
    mounted.delete(unmount);
    await act(async () => root.unmount());
    container.remove();
  };
  mounted.add(unmount);

  return {
    container,
    rerender: (next) => act(async () => root.render(next)),
    unmount,
  };
}

export async function renderHook<T>(
  useHook: () => T,
  { wrapper }: { wrapper?: ComponentType<{ children?: ReactNode }> } = {},
): Promise<MountedView & { result: { current: T; renders: number } }> {
  const result = { current: undefined as T, renders: 0 };

  function Probe(): ReactElement | null {
    result.current = useHook();
    result.renders += 1;
    return null;
  }

  const view = await render(wrapper ? h(wrapper, null, h(Probe)) : h(Probe));
  return { result, ...view };
}

export const flush = () => act(async () => {});
