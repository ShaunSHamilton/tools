import { createRoute, Navigate } from "@tanstack/react-router";
import { ttLayoutRoute } from "./route";

export const ttIndexRoute = createRoute({
  getParentRoute: () => ttLayoutRoute,
  path: "/",
  component: () => <Navigate to="/task-tracker/dashboard" replace />,
});
