import { createRoute } from "@tanstack/react-router";
import { ecLayoutRoute } from "./route";
import { Metrics } from "@/exam-creator/pages/metrics";
import { ProtectedRoute } from "@/exam-creator/components/protected-route";

export const ecMetricsRoute = createRoute({
  getParentRoute: () => ecLayoutRoute,
  path: "/metrics",
  component: () => (
    <ProtectedRoute>
      <Metrics />
    </ProtectedRoute>
  ),
});
