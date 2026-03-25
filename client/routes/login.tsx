import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { LoginForm } from "@/team-board/components/LoginForm";

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginForm,
});
