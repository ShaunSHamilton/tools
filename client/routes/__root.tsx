import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

export const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: () => <Outlet />,
});
