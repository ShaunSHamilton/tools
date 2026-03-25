import { useQuery } from "@tanstack/react-query";

import { getModerationsCount } from "../../utils/fetch";
import { Tooltip } from "../tooltip";
import { UsersOnPageAvatars } from "../users-on-page-avatars";

interface AttemptsLandingCardProps {
  path: string;
}

export function AttemptsLandingCard({ path }: AttemptsLandingCardProps) {
  const moderationsCountQuery = useQuery({
    queryKey: ["moderationsCount"],
    queryFn: getModerationsCount,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="rounded-xl shadow-md px-4 py-3 h-full min-h-[120px] hover:border-teal-400 hover:shadow-lg border-2 border-transparent transition-all duration-150 bg-card">
      <div className="pb-2">
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold text-primary truncate max-w-[80%]">
            Attempts
          </p>
        </div>
      </div>
      <div className="pt-2">
        <UsersOnPageAvatars path={path} />
      </div>
      <div className="flex flex-col pt-2">
        {moderationsCountQuery.isError ? (
          <p className="text-red-400 text-sm">
            {moderationsCountQuery.error.message}
          </p>
        ) : moderationsCountQuery.isPending ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-foreground border-t-transparent" />
        ) : null}

        {moderationsCountQuery.isSuccess && (
          <ModerationSummary moderationsCount={moderationsCountQuery.data} />
        )}
      </div>
    </div>
  );
}

interface ModerationSummaryProps {
  moderationsCount: Awaited<ReturnType<typeof getModerationsCount>>;
}

function ModerationSummary({ moderationsCount }: ModerationSummaryProps) {
  const statusOrder = ["approved", "denied", "pending"] as const;
  const { staging, production } = moderationsCount;

  const badgeColor = (statusKey: string) =>
    statusKey === "approved"
      ? "bg-green-500/20 text-green-400"
      : statusKey === "denied"
        ? "bg-red-500/20 text-red-400"
        : "bg-yellow-500/20 text-yellow-400";

  return (
    <div className="grid grid-cols-[1fr_repeat(3,2fr)] gap-2 items-center">
      <p className="text-xs font-semibold text-muted-foreground">Staging:</p>
      {statusOrder.map((statusKey) => (
        <Tooltip
          key={`staging-${statusKey}`}
          content={`${staging[statusKey]} ${statusKey} attempt${
            staging[statusKey] !== 1 ? "s" : ""
          }`}
        >
          <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-medium w-full text-center ${badgeColor(statusKey)}`}
          >
            {staging[statusKey]}
          </span>
        </Tooltip>
      ))}
      <p className="text-xs font-semibold text-muted-foreground">Production:</p>
      {statusOrder.map((statusKey) => (
        <Tooltip
          key={`production-${statusKey}`}
          content={`${production[statusKey]} ${statusKey} attempt${
            production[statusKey] !== 1 ? "s" : ""
          }`}
        >
          <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-medium w-full text-center ${badgeColor(statusKey)}`}
          >
            {production[statusKey]}
          </span>
        </Tooltip>
      ))}
    </div>
  );
}
