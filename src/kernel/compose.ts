import {
  createElement,
  Fragment,
  type ComponentType,
  type JSX,
  type ReactNode,
} from "react";

export type ProviderComponent<P = any> = ComponentType<
  P & { children?: ReactNode }
>;

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

export function Compose({ providers, children }: ComposeProps): JSX.Element {
  return providers.reduceRight<JSX.Element>(
    (acc, entry) => {
      if (Array.isArray(entry)) {
        const [Component, props] = entry;
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
