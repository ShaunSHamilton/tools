import { createRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { rootRoute } from "../__root";
import { AuthProvider } from "@/exam-creator/contexts/auth";
import { UsersWebSocketProvider } from "@/exam-creator/contexts/users-websocket";

function ECLayout() {
  return (
    <AuthProvider>
      <UsersWebSocketProvider>
        <main className="min-h-screen bg-background text-foreground">
          <Outlet />
          <Toaster richColors position="bottom-right" />
        </main>
      </UsersWebSocketProvider>
    </AuthProvider>
  );
}

export const ecLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/exam-creator",
  component: ECLayout,
});
