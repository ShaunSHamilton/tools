import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { SettingsPage } from "@/pages/settings";

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  beforeLoad: async () => {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) throw redirect({ to: "/login" });
  },
  component: SettingsPage,
});
