import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/task-tracker/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/task-tracker/components/ui/card";
import { useCurrentUser } from "@/team-board/hooks/useCurrentUser";
import { github, ApiError } from "@/task-tracker/lib/api";
import { useOrgs } from "@/hooks/useOrgs";

export function DashboardPage() {
  const { data: user } = useCurrentUser();

  const { data: ghStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["github", "status"],
    queryFn: () => github.status(),
  });

  const { data: orgsData = [] } = useOrgs();

  const connectMutation = useMutation({
    mutationFn: () => github.connectStart(),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          {user && (
            <p className="text-muted-foreground text-sm">{user.email}</p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>GitHub</CardTitle>
              <CardDescription>
                GitHub activity is fetched automatically when you generate a report.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : ghStatus?.connected ? (
                <p className="text-sm">
                  Connected as{" "}
                  <span className="font-medium">
                    @{ghStatus.connection.github_username}
                  </span>
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-sm">
                    No GitHub account connected.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                  >
                    {connectMutation.isPending ? "Redirecting…" : "Connect GitHub"}
                  </Button>
                  {connectMutation.isError && (
                    <p className="text-destructive text-xs">
                      {connectMutation.error instanceof ApiError
                        ? connectMutation.error.message
                        : "Failed to start connect flow."}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Organisations</CardTitle>
                  <CardDescription>
                    Share reports with your team.
                  </CardDescription>
                </div>
                <Link to="/settings">
                  <Button variant="outline" size="sm">Manage</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {!orgsData.length ? (
                <p className="text-muted-foreground text-sm">
                  No organisations yet.{" "}
                  <Link to="/settings" className="underline">
                    Create one in Settings.
                  </Link>
                </p>
              ) : (
                <div className="space-y-2">
                  {orgsData.map((org) => (
                    <Link
                      key={org.id}
                      to="/task-tracker/orgs/$id"
                      params={{ id: org.id }}
                      className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-card/80 transition-colors"
                    >
                      <span className="font-medium">{org.name}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {org.slug}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
