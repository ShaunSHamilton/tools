import { createRoute, Outlet } from "@tanstack/react-router";
import { rootRoute } from "../__root";

function TTLayout() {
  return <Outlet />;
}

export const ttLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/task-tracker",
  component: TTLayout,
});
