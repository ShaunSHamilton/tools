import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/task-tracker/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/task-tracker/components/ui/card";
import { Input } from "@/task-tracker/components/ui/input";
import { Label } from "@/task-tracker/components/ui/label";
import { orgs, ApiError } from "@/task-tracker/lib/api";

export function OrgNewPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => orgs.create({ name: name.trim() }),
    onSuccess: (org) => {
      navigate({ to: "/task-tracker/orgs/$slug", params: { slug: org.slug } });
    },
    onError: (e) => {
      setError(
        e instanceof ApiError ? e.message : "Failed to create organisation."
      );
    },
  });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-2xl font-semibold">Create organisation</h1>

        <Card>
          <CardHeader>
            <CardTitle>Organisation details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    setError(null);
                    mutation.mutate();
                  }
                }}
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button
              className="w-full"
              onClick={() => {
                setError(null);
                mutation.mutate();
              }}
              disabled={!name.trim() || mutation.isPending}
            >
              {mutation.isPending ? "Creating…" : "Create"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
