import { createRoute } from "@tanstack/react-router";
import { ecLayoutRoute } from "./route";
import { Edit as EditAttempt } from "@/exam-creator/pages/edit-attempt";
import { ProtectedRoute } from "@/exam-creator/components/protected-route";

type EditAttemptSearch = { filter?: string };

export const ecEditAttemptRoute = createRoute({
  getParentRoute: () => ecLayoutRoute,
  path: "/attempts/$id",
  validateSearch: (search: Record<string, unknown>): EditAttemptSearch => ({
    filter: search.filter as string | undefined,
  }),
  component: () => (
    <ProtectedRoute>
      <EditAttempt />
    </ProtectedRoute>
  ),
});
