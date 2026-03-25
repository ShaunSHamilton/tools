import { createRoute } from "@tanstack/react-router";
import { ecLayoutRoute } from "./route";
import { Exams } from "@/exam-creator/pages/exams";
import { ProtectedRoute } from "@/exam-creator/components/protected-route";

export const ecExamsRoute = createRoute({
  getParentRoute: () => ecLayoutRoute,
  path: "/exams",
  component: () => (
    <ProtectedRoute>
      <Exams />
    </ProtectedRoute>
  ),
});
