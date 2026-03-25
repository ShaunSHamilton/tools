import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/task-tracker/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/task-tracker/components/ui/card";
import { Input } from "@/task-tracker/components/ui/input";
import { Label } from "@/task-tracker/components/ui/label";
import { orgs, ApiError, type OrgReportSummary } from "@/task-tracker/lib/api";

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
  const { slug } = useParams({ from: "/task-tracker/_protected/orgs/$slug" });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["orgs", slug],
    queryFn: () => orgs.get(slug!),
    enabled: !!slug,
  });

  const { data: reportsData } = useQuery({
    queryKey: ["orgs", slug, "reports"],
    queryFn: () => orgs.listReports(slug!),
    enabled: !!slug,
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: () => orgs.invite(slug!, inviteEmail.trim()),
    onSuccess: () => {
      setInviteEmail("");
      setInviteError(null);
      setInviteSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["orgs", slug] });
    },
    onError: (e) => {
      setInviteError(
        e instanceof ApiError ? e.message : "Failed to send invite."
      );
    },
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground text-sm">Organisation not found.</p>
      </div>
    );
  }

  const { org, members, caller_role } = data;
  const isAdmin = caller_role === "admin";

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <p className="text-muted-foreground text-sm font-mono">
            {org.slug}
          </p>
        </div>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>{members.length} member{members.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground ml-2">{m.email}</span>
                </div>
                <span className="text-muted-foreground capitalize">{m.role}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Invite (admin only) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Invite member</CardTitle>
              <CardDescription>
                Send an invitation email to a new member.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      setInviteSuccess(false);
                    }}
                    placeholder="colleague@example.com"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      setInviteError(null);
                      setInviteSuccess(false);
                      inviteMutation.mutate();
                    }}
                    disabled={!inviteEmail.trim() || inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? "Sending…" : "Send invite"}
                  </Button>
                </div>
              </div>
              {inviteSuccess && (
                <p className="text-green-400 text-xs">Invite sent.</p>
              )}
              {inviteError && (
                <p className="text-destructive text-xs">{inviteError}</p>
              )}
            </CardContent>
          </Card>
        )}

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
