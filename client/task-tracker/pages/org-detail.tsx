import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/task-tracker/components/ui/card";
import { orgs, type OrgReportSummary } from "@/task-tracker/lib/api";
import { useOrgDetail } from "@/hooks/useOrgs";

function StatusBadge({ status }: { status: OrgReportSummary["status"] }) {
  const styles = {
    pending: "text-muted-foreground",
    generating: "text-yellow-400",
    completed: "text-green-400",
    failed: "text-destructive",
  } as const;
  return <span className={styles[status]}>{status}</span>;
}

export function OrgDetailPage() {
  const { id } = useParams({ from: "/task-tracker/_protected/orgs/$id" });

  const { data: orgData } = useOrgDetail(id!);

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ["tt-org-reports", id],
    queryFn: () => orgs.listReports(id!),
    enabled: !!id,
  });

  const orgName = orgData?.org.name ?? "Organisation";

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{orgName}</h1>
          </div>
          <Link
            to="/settings"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage members →
          </Link>
        </div>

        {/* Shared reports */}
        <Card>
          <CardHeader>
            <CardTitle>Shared reports</CardTitle>
            <CardDescription>
              Reports from members that are visible to this organisation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!reportsData?.reports.length ? (
              <p className="text-muted-foreground text-sm">
                No reports shared with this organisation yet.
              </p>
            ) : (
              <div className="space-y-3">
                {reportsData.reports.map((r) => (
                  <Link key={r.id} to="/task-tracker/reports/$id" params={{ id: r.id }}>
                    <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-card/80 transition-colors">
                      <div>
                        <p className="font-medium">{r.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {r.period_start} – {r.period_end} · {r.author_name}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
