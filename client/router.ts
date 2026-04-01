import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

// Root
import { rootRoute } from "./routes/__root";

// Home
import { homeRoute } from "./routes/index";

// Shared login
import { loginRoute } from "./routes/login";

// Settings (universal)
import { settingsRoute } from "./routes/settings";

// Exam Creator
import { ecLayoutRoute } from "./routes/exam-creator/route";
import { ecLandingRoute } from "./routes/exam-creator/index";
import { ecExamsRoute } from "./routes/exam-creator/exams";
import { ecEditExamRoute } from "./routes/exam-creator/exams_.$id";
import { ecAttemptsRoute } from "./routes/exam-creator/attempts";
import { ecEditAttemptRoute } from "./routes/exam-creator/attempts_.$id";
import { ecMetricsRoute } from "./routes/exam-creator/metrics";
import { ecViewMetricsRoute } from "./routes/exam-creator/metrics_.exams.$id";

// Team Board
import { tbLayoutRoute } from "./routes/team-board/route";
import { tbIndexRoute } from "./routes/team-board/index";
import { tbSettingsRoute } from "./routes/team-board/settings";

// Task Tracker
import { ttLayoutRoute } from "./routes/task-tracker/route";
import { ttIndexRoute } from "./routes/task-tracker/index";
import { ttProtectedRoute } from "./routes/task-tracker/_protected";
import { ttDashboardRoute } from "./routes/task-tracker/_protected.dashboard";
import { ttReportsRoute } from "./routes/task-tracker/_protected.reports";
import { ttReportViewRoute } from "./routes/task-tracker/_protected.reports_.$id";
import { ttOrgDetailRoute } from "./routes/task-tracker/_protected.orgs.$slug";
import { ttShareRoute } from "./routes/task-tracker/share.$token";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
});

const routeTree = rootRoute.addChildren([
  // Home
  homeRoute,
  // Shared login
  loginRoute,
  // Settings
  settingsRoute,
  // Exam Creator
  ecLayoutRoute.addChildren([
    ecLandingRoute,
    ecExamsRoute,
    ecEditExamRoute,
    ecAttemptsRoute,
    ecEditAttemptRoute,
    ecMetricsRoute,
    ecViewMetricsRoute,
  ]),
  // Team Board
  tbLayoutRoute.addChildren([
    tbIndexRoute,
    tbSettingsRoute,
  ]),
  // Task Tracker
  ttLayoutRoute.addChildren([
    ttIndexRoute,
    ttShareRoute,
    ttProtectedRoute.addChildren([
      ttDashboardRoute,
      ttReportsRoute,
      ttReportViewRoute,
      ttOrgDetailRoute,
    ]),
  ]),
]);

export const router = createRouter({ routeTree, context: { queryClient } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
