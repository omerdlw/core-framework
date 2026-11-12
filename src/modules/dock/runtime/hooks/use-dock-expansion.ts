"use client";

import { type Dispatch, type SetStateAction, useState } from "react";

function createExpansionActions(
  setExpandedState: Dispatch<SetStateAction<boolean>>,
) {
  return {
    collapse: () => setExpandedState(false),
    expand: () => setExpandedState(true),
    setExpanded: (nextValue: boolean | ((prev: boolean) => boolean)) =>
      setExpandedState((prev) =>
        Boolean(typeof nextValue === "function" ? nextValue(prev) : nextValue),
      ),
    toggle: () => setExpandedState((prev) => !prev),
  };
}

export function useDockExpansion() {
  const [expanded, setExpandedState] = useState(false);
  const [actions] = useState(() => createExpansionActions(setExpandedState));

  return { actions, expanded };
}
