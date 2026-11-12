"use client";

import { useEffect, useLayoutEffect } from "react";
import { isBrowser } from "@/foundation/utils";

export const useIsomorphicLayoutEffect = isBrowser
  ? useLayoutEffect
  : useEffect;
