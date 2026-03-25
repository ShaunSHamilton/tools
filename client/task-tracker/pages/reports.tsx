import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/task-tracker/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/task-tracker/components/ui/card";
import { Input } from "@/task-tracker/components/ui/input";
import { Label } from "@/task-tracker/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/task-tracker/components/ui/dialog";
import { Textarea } from "@/task-tracker/components/ui/textarea";
import { reports, orgs, ApiError, type ReportSummary } from "@/task-tracker/lib/api";

function DeleteReportButton({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => reports.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });

  if (confirming) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
        <span className="text-xs text-muted-foreground">Delete?</span>
        <Button
          variant="destructive"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "…" : "Yes"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => setConfirming(false)}
        >
          No
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
      onClick={(e) => {
        e.preventDefault();
        setConfirming(true);
      }}
    >
      Delete
    </Button>
  );
}

function StatusBadge({ status }: { status: ReportSummary["status"] }) {
  const styles = {
    pending: "text-muted-foreground",
    generating: "text-yellow-400",
    completed: "text-green-400",
    failed: "text-destructive",
  } as const;
  return <span className={styles[status]}>{status}</span>;
}

function CreateReportDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: orgsData } = useQuery({
    queryKey: ["orgs"],
    queryFn: () => orgs.list(),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      reports.create({
        period_start: periodStart,
        period_end: periodEnd,
        custom_instructions: customInstructions.trim() || null,
        org_ids: selectedOrgIds.length ? selectedOrgIds : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setOpen(false);
      setPeriodStart("");
      setPeriodEnd("");
      setCustomInstructions("");
      setSelectedOrgIds([]);
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : "Failed to create report.");
    },
  });

  function toggleOrg(id: string) {
    setSelectedOrgIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Generate report</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="start">Start date</Label>
              <Input
                id="start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end">End date</Label>
              <Input
                id="end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          {orgsData && orgsData.orgs.length > 0 && (
            <div className="space-y-2">
              <Label>
                Share with organisations{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <div className="space-y-1">
                {orgsData.orgs.map((org) => (
                  <label
                    key={org.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOrgIds.includes(org.id)}
                      onChange={() => toggleOrg(org.id)}
                      className="accent-primary"
                    />
                    {org.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="instructions">
              Custom instructions{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="instructions"
              placeholder="Leave blank to use the default structured report format. Or describe your own structure here."
              rows={4}
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button
            className="w-full"
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!periodStart || !periodEnd || mutation.isPending}
          >
            {mutation.isPending ? "Creating…" : "Generate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => reports.list(),
  });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Reports</h1>
          <CreateReportDialog />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !data?.reports.length ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm">
                No reports yet. Generate one to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.reports.map((r) => (
              <Link key={r.id} to="/task-tracker/reports/$id" params={{ id: r.id }}>
                <Card className="hover:bg-card/80 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{r.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        <DeleteReportButton id={r.id} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-xs">
                      {r.period_start} – {r.period_end}
                      {r.generated_at &&
                        ` · Generated ${new Date(r.generated_at).toLocaleDateString()}`}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
