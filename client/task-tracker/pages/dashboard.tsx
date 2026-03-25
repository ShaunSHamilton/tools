import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/task-tracker/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/task-tracker/components/ui/card";
import { useAuth } from "@/task-tracker/contexts/auth-context";
import { github, orgs, ApiError } from "@/task-tracker/lib/api";

export function DashboardPage() {
  const { user } = useAuth();

  const { data: ghStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["github", "status"],
    queryFn: () => github.status(),
  });

  const { data: orgsData } = useQuery({
    queryKey: ["orgs"],
    queryFn: () => orgs.list(),
  });

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
                <Link to="/task-tracker/orgs/new">
                  <Button variant="outline" size="sm">New org</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {!orgsData?.orgs.length ? (
                <p className="text-muted-foreground text-sm">
                  No organisations yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {orgsData.orgs.map((org) => (
                    <Link
                      key={org.id}
                      to="/task-tracker/orgs/$slug"
                      params={{ slug: org.slug }}
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
