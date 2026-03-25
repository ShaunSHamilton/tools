import { createRoute } from "@tanstack/react-router";
import { ttProtectedRoute } from "./_protected";
import { ReportViewPage } from "@/task-tracker/pages/report-view";

export const ttReportViewRoute = createRoute({
  getParentRoute: () => ttProtectedRoute,
  path: "/reports/$id",
  component: ReportViewPage,
});
