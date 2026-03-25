import { createRoute } from "@tanstack/react-router";
import { ttProtectedRoute } from "./_protected";
import { OrgInviteAcceptPage } from "@/task-tracker/pages/org-invite-accept";

export const ttOrgInviteAcceptRoute = createRoute({
  getParentRoute: () => ttProtectedRoute,
  path: "/orgs/invites/$token",
  component: OrgInviteAcceptPage,
});
