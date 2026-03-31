import { createRoute, Outlet, Navigate } from "@tanstack/react-router";
import { ttLayoutRoute } from "./route";
import { useCurrentUser } from "@/team-board/hooks/useCurrentUser";
import { AppLayout } from "@/task-tracker/components/app-layout";

function TTProtected() {
  const { data: user, status } = useCurrentUser();
  if (status === "pending") {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="text-muted-foreground text-sm">Loading...</span>
      </div>
    );
  }
  if (status === "error" || !user) return <Navigate to="/login" />;
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export const ttProtectedRoute = createRoute({
  getParentRoute: () => ttLayoutRoute,
  id: "_protected",
  component: TTProtected,
});
