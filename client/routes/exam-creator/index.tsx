import { createRoute } from "@tanstack/react-router";
import { ecLayoutRoute } from "./route";
import { Landing } from "@/exam-creator/pages/landing";
import { ProtectedRoute } from "@/exam-creator/components/protected-route";

export const ecLandingRoute = createRoute({
  getParentRoute: () => ecLayoutRoute,
  path: "/",
  component: () => (
    <ProtectedRoute>
      <Landing />
    </ProtectedRoute>
  ),
});
