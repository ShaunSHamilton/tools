import { createRoute } from "@tanstack/react-router";
import { tbLayoutRoute } from "./route";
import App from "@/team-board/App";

export const tbIndexRoute = createRoute({
  getParentRoute: () => tbLayoutRoute,
  path: "/",
  component: App,
});
