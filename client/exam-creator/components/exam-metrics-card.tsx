import { useNavigate } from "@tanstack/react-router";
import type { ExamCreatorExam } from "@prisma/client";

interface ExamCardProps {
  exam: Omit<ExamCreatorExam, "questionSets">;
  numberOfAttempts: number;
}

export function ExamMetricsCard({ exam, numberOfAttempts }: ExamCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate({ to: "/exam-creator/metrics/exams/$id", params: { id: exam.id } });
  };

  return (
    <button
      className="w-full h-auto p-0 hover:shadow-xl hover:-translate-y-0.5 rounded-xl transition-all duration-150 block text-left bg-muted"
      onClick={handleClick}
    >
      <div className="rounded-xl shadow-md p-3 h-full min-h-[120px] hover:border-teal-400 hover:shadow-lg border-2 border-transparent transition-all duration-150 bg-card">
        <div className="pb-2 p-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <p className="text-xl font-bold truncate flex-1 min-w-0 text-primary">
                {exam.config.name}
              </p>
            </div>
            {exam.deprecated && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 ml-2 shrink-0 min-w-[90px] text-center justify-center">
                Deprecated
              </span>
            )}
          </div>
        </div>
        <div className="pt-2 p-1">
          <p className="text-base">Number of Attempts: {numberOfAttempts}</p>
        </div>
      </div>
    </button>
  );
}
