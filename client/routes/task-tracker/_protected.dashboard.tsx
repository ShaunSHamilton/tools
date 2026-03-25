import { createRoute } from "@tanstack/react-router";
import { ttProtectedRoute } from "./_protected";
import { DashboardPage } from "@/task-tracker/pages/dashboard";

export const ttDashboardRoute = createRoute({
  getParentRoute: () => ttProtectedRoute,
  path: "/dashboard",
  component: DashboardPage,
});
