import { createRoute } from "@tanstack/react-router";
import { ttProtectedRoute } from "./_protected";
import { ReportsPage } from "@/task-tracker/pages/reports";

export const ttReportsRoute = createRoute({
  getParentRoute: () => ttProtectedRoute,
  path: "/reports",
  component: ReportsPage,
});
