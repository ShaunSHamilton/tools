import { useNavigate } from "@tanstack/react-router";
import {
  ExamEnvironmentExamModeration,
  ExamEnvironmentExamModerationStatus,
} from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { getAttemptById } from "../utils/fetch";
import { prettyDate } from "../utils/question";
import { Tooltip } from "./tooltip";
import { UsersOnPageAvatars } from "./users-on-page-avatars";

interface ModerationCardProps {
  moderation: ExamEnvironmentExamModeration;
  filter: ExamEnvironmentExamModerationStatus;
}

export function ModerationCard({ moderation, filter }: ModerationCardProps) {
  const navigate = useNavigate();

  const attemptQuery = useQuery({
    queryKey: ["attempt", moderation.examAttemptId],
    queryFn: () => getAttemptById(moderation.examAttemptId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  return (
    <button
      className="w-full h-auto p-0 hover:shadow-xl hover:-translate-y-0.5 rounded-xl transition-all duration-150 block text-left disabled:opacity-50"
      onClick={() =>
        navigate({
          to: "/exam-creator/attempts/$id",
          params: { id: moderation.examAttemptId },
          search: {
            filter,
          },
        })
      }
      disabled={attemptQuery.isPending || attemptQuery.isError}
    >
      <div className="bg-muted rounded-xl shadow-md p-4 h-full min-h-[120px] hover:border-teal-400 hover:shadow-lg border-2 border-transparent transition-all duration-150">
        <div className="pb-2">
          <div className="flex items-center justify-between">
            {attemptQuery.isPending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-teal-400 border-t-transparent" />
            ) : (
              <p
                className={`text-xl font-bold truncate max-w-[80%] ${
                  attemptQuery.isError ? "text-red-400" : "text-teal-400"
                }`}
              >
                {attemptQuery.isError
                  ? attemptQuery.error.message
                  : attemptQuery.data.config.name}
              </p>
            )}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ml-2 ${
                moderation.status === "Pending"
                  ? "bg-blue-500/20 text-blue-400"
                  : moderation.status === "Approved"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
              }`}
            >
              {moderation.status}
            </span>
          </div>
          <Tooltip content={`Moderation ID`} showArrow>
            <p className="text-muted-foreground text-sm w-fit">
              {moderation.id}
            </p>
          </Tooltip>
        </div>
        <div className="pt-2">
          <div className="flex items-center justify-between">
            <UsersOnPageAvatars
              path={`/attempts/${moderation.examAttemptId}`}
            />
            <span className="text-muted-foreground text-sm ml-2">
              Passing Percent:{" "}
              {attemptQuery.isPending ? (
                <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-teal-400 border-t-transparent" />
              ) : attemptQuery.isError ? (
                "--"
              ) : (
                attemptQuery.data.config.passingPercent
              )}
            </span>
          </div>
          <div className="flex flex-col items-start gap-1 mt-4 text-sm text-muted-foreground">
            {moderation.feedback && (
              <p>
                <span className="font-bold text-foreground/60">Feedback:</span>{" "}
                {moderation.feedback}
              </p>
            )}
            {moderation.moderationDate && (
              <p>
                <span className="font-bold text-foreground/60">Moderation Date:</span>{" "}
                {prettyDate(moderation.moderationDate)}
              </p>
            )}
            {moderation.moderatorId && (
              <p>
                <span className="font-bold text-foreground/60">Moderator ID:</span>{" "}
                {moderation.moderatorId}
              </p>
            )}
            <p>
              <span className="font-bold text-foreground/60">Submission Date:</span>{" "}
              {prettyDate(moderation.submissionDate)}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
