import {
  type ComponentType,
  createElement,
  Fragment,
  type JSX,
  type ReactNode,
} from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider props are erased at the composition boundary
export type ProviderComponent<P = any> = ComponentType<
  P & { children?: ReactNode }
>;

/**
 * A provider component, or a [component, props] pair.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider props are erased at the composition boundary
export type ProviderEntry<P = any> =
  ProviderComponent<P> | readonly [ProviderComponent<P>, P];

export interface ComposeProps {
  children?: ReactNode;
  providers: readonly ProviderEntry[];
}

export function createProviderEntry<P extends object>(
  component: ProviderComponent<P>,
  props: P,
): readonly [ProviderComponent<P>, P] {
  return [component, props] as const;
}

/**
 * Nests the given providers around its children, first entry outermost.
 */
export function Compose({ providers, children }: ComposeProps): JSX.Element {
  return providers.reduceRight<JSX.Element>(
    (acc, entry) => {
      if (Array.isArray(entry)) {
        const [Component, props] = entry;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- provider props are erased at the composition boundary
        return createElement(Component, props, acc);
      }
      const Component = entry as ProviderComponent;
      return createElement(Component, null, acc);
    },
    createElement(Fragment, null, children),
  );
}

export function composeProviders(
  providers: readonly ProviderEntry[],
): (props: { children?: ReactNode }) => JSX.Element {
  function ComposedProviders({
    children,
  }: {
    children?: ReactNode;
  }): JSX.Element {
    return Compose({ providers, children });
  }
  ComposedProviders.displayName = "ComposedProviders";
  return ComposedProviders;
}
