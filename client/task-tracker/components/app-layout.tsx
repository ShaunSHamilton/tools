import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/task-tracker/components/ui/button";
import { useAuth } from "@/task-tracker/contexts/auth-context";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex h-screen">
      <aside className="w-56 flex-shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <span className="font-semibold text-sm tracking-tight">TaskTracker</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          <Link
            to="/task-tracker/dashboard"
            activeProps={{ className: "flex items-center px-3 py-2 text-sm rounded-md transition-colors bg-card text-foreground" }}
            inactiveProps={{ className: "flex items-center px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:bg-card/60 hover:text-foreground" }}
          >
            Dashboard
          </Link>
          <Link
            to="/task-tracker/reports"
            activeProps={{ className: "flex items-center px-3 py-2 text-sm rounded-md transition-colors bg-card text-foreground" }}
            inactiveProps={{ className: "flex items-center px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:bg-card/60 hover:text-foreground" }}
          >
            Reports
          </Link>
        </nav>
        <div className="p-4 border-t border-border space-y-2">
          {user && (
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground px-2"
            onClick={handleLogout}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
