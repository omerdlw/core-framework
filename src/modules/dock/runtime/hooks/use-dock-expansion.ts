"use client";

import { useCallback, useMemo, useState } from "react";

export function useDockExpansion() {
  const [expanded, setExpandedState] = useState(false);

  const setExpanded = useCallback(
    (nextValue: boolean | ((prev: boolean) => boolean)) =>
      setExpandedState((prev) =>
        Boolean(typeof nextValue === "function" ? nextValue(prev) : nextValue),
      ),
    [],
  );
  const collapse = useCallback(() => setExpandedState(false), []);
  const expand = useCallback(() => setExpandedState(true), []);
  const toggle = useCallback(() => setExpandedState((prev) => !prev), []);

  const actions = useMemo(
    () => ({ collapse, expand, setExpanded, toggle }),
    [collapse, expand, setExpanded, toggle],
  );

  return { actions, expanded };
}
