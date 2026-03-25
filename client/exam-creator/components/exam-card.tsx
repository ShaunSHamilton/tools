import { useNavigate } from "@tanstack/react-router";
import type { ExamCreatorExam } from "@prisma/client";
import { Tooltip } from "./tooltip";
import { UsersOnPageAvatars } from "./users-on-page-avatars";

interface ExamCardProps {
  exam: Omit<ExamCreatorExam, "questionSets">;
  isSelected?: boolean;
  onSelectionChange?: (examId: string, selected: boolean) => void;
  selectionMode?: boolean;
  databaseEnvironments: ("Staging" | "Production")[];
}

export function ExamCard({
  exam,
  isSelected = false,
  onSelectionChange,
  selectionMode = false,
  databaseEnvironments,
}: ExamCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (selectionMode && onSelectionChange) {
      onSelectionChange(exam.id, !isSelected);
    } else {
      navigate({ to: "/exam-creator/exams/$id", params: { id: exam.id } });
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectionChange?.(exam.id, e.target.checked);
  };

  return (
    <button
      className="w-full h-auto p-0 hover:shadow-xl hover:-translate-y-0.5 rounded-xl transition-all duration-150 block text-left bg-card"
      onClick={handleClick}
    >
      <div
        className={`rounded-xl shadow-md p-3 h-full min-h-[120px] hover:border-primary hover:shadow-lg border-2 transition-all duration-150 ${
          isSelected ? "border-primary" : "border-transparent"
        }`}
      >
        <div className="pb-2 p-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {selectionMode && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={handleCheckboxChange}
                  onClick={(e) => e.stopPropagation()}
                  className="h-5 w-5 accent-teal-500 cursor-pointer"
                />
              )}
              <p className="text-xl font-bold text-primary truncate flex-1 min-w-0">
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
          <UsersOnPageAvatars path={`/exams/${exam.id}`} />
        </div>
        <div className="flex justify-evenly pt-2">
          {databaseEnvironments.map((env) => (
            <Tooltip
              content={`This exam is seeded in the ${env} database`}
              key={env}
            >
              <span
                className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium min-w-[90px] ${
                  env === "Production"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {env}
              </span>
            </Tooltip>
          ))}
        </div>
      </div>
    </button>
  );
}
