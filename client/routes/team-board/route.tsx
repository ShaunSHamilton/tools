import { createRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { rootRoute } from "../__root";

function TBLayout() {
  return (
    <>
      <Outlet />
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              'bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800',
            error: 'text-red-600 dark:text-red-400',
          },
        }}
      />
    </>
  );
}

export const tbLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/team-board",
  component: TBLayout,
});
