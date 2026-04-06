import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useNotificationStream } from "@/components/notifications/useNotificationStream";

function Root() {
  useNotificationStream()
  return (
    <>
      <Outlet />
      <Toaster position="bottom-right" />
    </>
  )
}

export const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: Root,
});
