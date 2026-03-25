import { createRoute } from "@tanstack/react-router";
import { ttProtectedRoute } from "./_protected";
import { OrgDetailPage } from "@/task-tracker/pages/org-detail";

export const ttOrgDetailRoute = createRoute({
  getParentRoute: () => ttProtectedRoute,
  path: "/orgs/$slug",
  component: OrgDetailPage,
});
