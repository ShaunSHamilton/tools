import { useEffect, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { orgs, ApiError } from "@/task-tracker/lib/api";

export function OrgInviteAcceptPage() {
  const { token } = useParams({ from: "/task-tracker/_protected/orgs/invites/$token" });
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    orgs
      .acceptInvite(token)
      .then((org) => navigate({ to: "/task-tracker/orgs/$slug", params: { slug: org.slug } }))
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "Failed to accept invite.");
      });
  }, [token, navigate]);

  if (error) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-md space-y-2">
          <h1 className="text-2xl font-semibold">Invite error</h1>
          <p className="text-destructive text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-md">
        <p className="text-muted-foreground text-sm">Accepting invite…</p>
      </div>
    </div>
  );
}
