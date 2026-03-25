import { createRoute, Outlet } from "@tanstack/react-router";
import { rootRoute } from "../__root";
import { AuthProvider } from "@/task-tracker/contexts/auth-context";

function TTLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const ttLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/task-tracker",
  component: TTLayout,
});
