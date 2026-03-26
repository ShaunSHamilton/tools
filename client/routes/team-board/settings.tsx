import { createRoute } from "@tanstack/react-router";
import { tbLayoutRoute } from "./route";
import { SettingsPage } from "@/team-board/pages/SettingsPage";

export const tbSettingsRoute = createRoute({
  getParentRoute: () => tbLayoutRoute,
  path: "/settings",
  component: SettingsPage,
});
