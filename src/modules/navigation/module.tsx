"use client";

import { defineModule } from "@/core/kernel";
import { NavigationContext, NavigationProvider } from "./context";
import type { NavigationTrip } from "@/core/navigation/types";

export const navigationModule = defineModule({
  id: "navigation",
  context: NavigationContext,
  Provider: NavigationProvider,
});

interface NavigationEventPayload {
  from: string;
  source: string;
  timestamp: number;
  to: string;
  trip: NavigationTrip;
  type: string;
  [key: string]: unknown;
}

declare module "@omerdlw/base-framework/events" {
  interface FrameworkEventMap {
    NAVIGATION_START: NavigationEventPayload;
    NAVIGATION_COMMIT: NavigationEventPayload;
    NAVIGATION_END: NavigationEventPayload;
  }
}

declare module "@omerdlw/base-framework/kernel" {
  interface CoreModules {
    navigation: typeof navigationModule;
  }
}
