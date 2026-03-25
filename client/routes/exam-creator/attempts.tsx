import { createRoute } from "@tanstack/react-router";
import { ecLayoutRoute } from "./route";
import { Attempts } from "@/exam-creator/pages/attempts";
import { ProtectedRoute } from "@/exam-creator/components/protected-route";

type AttemptsSearch = { filter?: string; sort?: number };

export const ecAttemptsRoute = createRoute({
  getParentRoute: () => ecLayoutRoute,
  path: "/attempts",
  validateSearch: (search: Record<string, unknown>): AttemptsSearch => ({
    filter: search.filter as string | undefined,
    sort: search.sort !== undefined ? Number(search.sort) : undefined,
  }),
  component: () => (
    <ProtectedRoute>
      <Attempts />
    </ProtectedRoute>
  ),
});
