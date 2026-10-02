export const navigationTestState = {
  pathname: "/",
  searchParams: new URLSearchParams(),
  routerCalls: [],
};

const record =
  (method) =>
  (...args) => {
    navigationTestState.routerCalls.push([method, ...args]);
  };

const router = Object.freeze({
  back: record("back"),
  forward: record("forward"),
  prefetch: record("prefetch"),
  push: record("push"),
  refresh: record("refresh"),
  replace: record("replace"),
});

export function usePathname() {
  return navigationTestState.pathname;
}

export function useRouter() {
  return router;
}

export function useSearchParams() {
  return navigationTestState.searchParams;
}

export function useParams() {
  return {};
}

export function redirect(href) {
  throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: href });
}

export function notFound() {
  throw new Error("notFound() is not supported in tests");
}
