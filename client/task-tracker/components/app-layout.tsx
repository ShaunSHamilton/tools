import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser, effectiveName } from "@/team-board/hooks/useCurrentUser";
import { NavBar } from "@/components/nav-bar";

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // best-effort
    }
    qc.clear();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex flex-col h-screen">
      <NavBar
        appName="Task Tracker"
        appHref="/task-tracker"
        userName={user ? effectiveName(user) : undefined}
        onLogout={handleLogout}
      />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 flex-shrink-0 border-r border-border flex flex-col">
          <nav className="flex-1 p-2 space-y-0.5 pt-4">
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
        </aside>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
