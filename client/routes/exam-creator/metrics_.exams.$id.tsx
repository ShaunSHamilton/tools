import { createRoute } from "@tanstack/react-router";
import { ecLayoutRoute } from "./route";
import { View as ViewMetrics } from "@/exam-creator/pages/view-metrics";
import { ProtectedRoute } from "@/exam-creator/components/protected-route";

export const ecViewMetricsRoute = createRoute({
  getParentRoute: () => ecLayoutRoute,
  path: "/metrics/exams/$id",
  component: () => (
    <ProtectedRoute>
      <ViewMetrics />
    </ProtectedRoute>
  ),
});
