import { createRoute } from "@tanstack/react-router";
import { ecLayoutRoute } from "./route";
import { Edit as EditExam } from "@/exam-creator/pages/edit-exam";
import { ProtectedRoute } from "@/exam-creator/components/protected-route";

export const ecEditExamRoute = createRoute({
  getParentRoute: () => ecLayoutRoute,
  path: "/exams/$id",
  component: () => (
    <ProtectedRoute>
      <EditExam />
    </ProtectedRoute>
  ),
});
