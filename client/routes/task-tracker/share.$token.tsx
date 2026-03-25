import { createRoute } from "@tanstack/react-router";
import { ttLayoutRoute } from "./route";
import { SharePage } from "@/task-tracker/pages/share";

export const ttShareRoute = createRoute({
  getParentRoute: () => ttLayoutRoute,
  path: "/share/$token",
  component: SharePage,
});
