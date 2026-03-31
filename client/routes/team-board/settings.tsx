import { createRoute, redirect } from "@tanstack/react-router";
import { tbLayoutRoute } from "./route";

export const tbSettingsRoute = createRoute({
  getParentRoute: () => tbLayoutRoute,
  path: "/settings",
  beforeLoad: () => {
    throw redirect({ to: "/settings" });
  },
  component: () => null,
});
