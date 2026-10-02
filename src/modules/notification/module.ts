"use client";

import { useMemo } from "react";
import {
  defineModule,
  type PageConfig,
  type PageModuleApi,
} from "@/kernel";
import { NotificationContext, NotificationProvider } from "./context";
import { useToast } from "./hooks";
import { NotificationLayer } from "./overlay";
import { type NotificationPageApi, type NotificationPageConfig } from "./types";

function selectToastDuration(config: PageConfig): number | null {
  const notification = config.notification;
  if (typeof notification === "number") return notification;
  return notification?.duration ?? null;
}

function useNotificationPage(
  duration: number | null,
  page: PageModuleApi,
): NotificationPageApi {
  const toast = useToast(duration);
  return useMemo(
    () => ({
      set: (notification: NotificationPageConfig) => page.set({ notification }),
      toast,
    }),
    [page, toast],
  );
}

export const notificationModule = defineModule({
  id: "notification",
  context: NotificationContext,
  Provider: NotificationProvider,
  Overlay: NotificationLayer,
  page: {
    select: selectToastDuration,
    use: useNotificationPage,
  },
});

declare module "@/kernel" {
  interface CoreModules {
    notification: typeof notificationModule;
  }
  interface PageConfig {
    notification?: NotificationPageConfig;
  }
}
