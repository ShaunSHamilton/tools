import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { HomePage } from "@/pages/home";
export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) throw redirect({ to: "/login" });
  },
  component: HomePage,
});
