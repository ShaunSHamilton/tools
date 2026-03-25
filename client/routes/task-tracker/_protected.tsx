import { createRoute, Outlet, Navigate } from "@tanstack/react-router";
import { ttLayoutRoute } from "./route";
import { useAuth } from "@/task-tracker/contexts/auth-context";
import { AppLayout } from "@/task-tracker/components/app-layout";

function TTProtected() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="text-muted-foreground text-sm">Loading...</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
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
