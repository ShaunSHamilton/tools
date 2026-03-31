import { useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { getExamsMetrics } from "../utils/fetch";
import { UsersWebSocketActivityContext } from "../contexts/users-websocket";
import { AuthContext } from "../contexts/auth";
import { ExamMetricsCard } from "../components/exam-metrics-card";
import { Header } from "../components/ui/header";
import { NavBar } from "@/components/nav-bar";

export function Metrics() {
  const { user, logout } = useContext(AuthContext)!;
  const { updateActivity } = useContext(UsersWebSocketActivityContext)!;

  const metricsQuery = useQuery({
    queryKey: ["metrics"],
    enabled: !!user,
    queryFn: () => getExamsMetrics(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    updateActivity({
      page: new URL(window.location.href),
      lastActive: Date.now(),
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar
        appName="Exam Creator"
        color="teal"
        appHref="/exam-creator"
        userName={user?.name}
        onLogout={logout}
      />
      <div className="py-12 px-4 flex-1">
      <div className="flex items-center justify-center">
        <div className="flex flex-col gap-8 w-full max-w-7xl">
          <Header title="Exam Metrics" description="View metrics for exams" />
          <div>
            {metricsQuery.isPending ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-400 border-t-transparent" />
              </div>
            ) : metricsQuery.isError ? (
              <div className="flex items-center justify-center">
                <p className="text-red-400 text-lg">
                  {metricsQuery.error.message}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-8">
                {metricsQuery.data.map(({ exam, numberOfAttempts }) => (
                  <ExamMetricsCard
                    key={exam.id}
                    exam={exam}
                    numberOfAttempts={numberOfAttempts}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
