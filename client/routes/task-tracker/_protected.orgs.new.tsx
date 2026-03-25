import { createRoute } from "@tanstack/react-router";
import { ttProtectedRoute } from "./_protected";
import { OrgNewPage } from "@/task-tracker/pages/org-new";

export const ttOrgNewRoute = createRoute({
  getParentRoute: () => ttProtectedRoute,
  path: "/orgs/new",
  component: OrgNewPage,
});
