import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/task-tracker/components/ui/button";
import { Card, CardContent } from "@/task-tracker/components/ui/card";
import { reports } from "@/task-tracker/lib/api";
import { useOrgs } from "@/hooks/useOrgs";

const POLL_INTERVAL_MS = 3000;

export function ReportViewPage() {
  const { id } = useParams({ from: "/task-tracker/_protected/reports/$id" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[] | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const { data: report, isLoading } = useQuery({
    queryKey: ["reports", id],
    queryFn: () => reports.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "generating"
        ? POLL_INTERVAL_MS
        : false;
    },
  });

  const shareMutation = useMutation({
    mutationFn: () => reports.share(id!),
    onSuccess: (data) => setShareUrl(data.url),
  });

  const deleteMutation = useMutation({
    mutationFn: () => reports.delete(id!),
    onSuccess: () => navigate({ to: "/task-tracker/reports" }),
  });

  const renameMutation = useMutation({
    mutationFn: (title: string) => reports.rename(id!, title),
    onSuccess: (_data, title) => {
      queryClient.setQueryData(["reports", id], (old: typeof report) =>
        old ? { ...old, title } : old
      );
      queryClient.setQueryData(["reports"], (old: { reports: typeof report[] } | undefined) =>
        old
          ? { reports: old.reports.map((r) => (r?.id === id ? { ...r, title } : r)) }
          : old
      );
      setEditingTitle(false);
    },
  });

  function startEditingTitle() {
    setTitleDraft(report?.title ?? "");
    setEditingTitle(true);
  }

  function commitTitle() {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== report?.title) {
      renameMutation.mutate(trimmed);
    } else {
      setEditingTitle(false);
    }
  }

  const { data: orgsData = [] } = useOrgs();

  const { data: reportOrgsData } = useQuery({
    queryKey: ["reports", id, "orgs"],
    queryFn: () => reports.getOrgs(id!),
    enabled: !!id,
  });

  // Initialise selectedOrgIds from fetched data (once)
  useEffect(() => {
    if (reportOrgsData && selectedOrgIds === null) {
      setSelectedOrgIds(reportOrgsData.org_ids);
    }
  }, [reportOrgsData, selectedOrgIds]);

  const updateOrgsMutation = useMutation({
    mutationFn: (ids: string[]) => reports.updateOrgs(id!, ids),
    onSuccess: (_data, ids) => {
      setSelectedOrgIds(ids);
      queryClient.setQueryData(["reports", id, "orgs"], { org_ids: ids });
    },
  });

  function toggleOrg(orgId: string) {
    setSelectedOrgIds((prev) =>
      prev === null
        ? [orgId]
        : prev.includes(orgId)
          ? prev.filter((x) => x !== orgId)
          : [...prev, orgId]
    );
  }

  const orgsDirty =
    selectedOrgIds !== null &&
    reportOrgsData !== undefined &&
    (selectedOrgIds.length !== reportOrgsData.org_ids.length ||
      selectedOrgIds.some((id) => !reportOrgsData.org_ids.includes(id)));

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const mailtoHref = shareUrl
    ? `mailto:?subject=${encodeURIComponent(report?.title ?? "Activity report")}&body=${encodeURIComponent(`Here is my activity report:\n${shareUrl}`)}`
    : undefined;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          {report && (
            <div className="mt-2 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  {editingTitle ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        className="text-2xl font-semibold bg-transparent border-b border-border outline-none w-80"
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitTitle();
                          if (e.key === "Escape") setEditingTitle(false);
                        }}
                        onBlur={commitTitle}
                        disabled={renameMutation.isPending}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTitle(false)}
                        disabled={renameMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <h1
                      className="text-2xl font-semibold cursor-pointer hover:underline decoration-dotted"
                      onClick={startEditingTitle}
                      title="Click to rename"
                    >
                      {report.title}
                    </h1>
                  )}
                  {confirmDelete ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">Delete?</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? "Deleting…" : "Yes, delete"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {report.period_start} – {report.period_end}
                </p>
              </div>

              {report.status === "completed" && (
                <div className="flex items-center gap-2 shrink-0">
                  {shareUrl ? (
                    <>
                      <code className="text-muted-foreground text-xs font-mono truncate max-w-40">
                        {shareUrl}
                      </code>
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                      {mailtoHref && (
                        <a href={mailtoHref}>
                          <Button variant="outline" size="sm">Email</Button>
                        </a>
                      )}
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareMutation.mutate()}
                      disabled={shareMutation.isPending}
                    >
                      {shareMutation.isPending ? "Sharing…" : "Share"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {report && orgsData.length > 0 && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Share with organisations</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {orgsData.map((org) => (
                      <label
                        key={org.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOrgIds?.includes(org.id) ?? false}
                          onChange={() => toggleOrg(org.id)}
                          className="accent-primary"
                        />
                        {org.name}
                      </label>
                    ))}
                  </div>
                </div>
                {orgsDirty && (
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={() => updateOrgsMutation.mutate(selectedOrgIds!)}
                    disabled={updateOrgsMutation.isPending}
                  >
                    {updateOrgsMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !report ? (
          <p className="text-muted-foreground text-sm">Report not found.</p>
        ) : report.status === "pending" || report.status === "generating" ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm animate-pulse">
                {report.status === "pending"
                  ? "Queued for generation…"
                  : "Generating report…"}
              </p>
            </CardContent>
          </Card>
        ) : report.status === "failed" ? (
          <Card>
            <CardContent className="pt-6 space-y-2">
              <p className="text-destructive text-sm font-medium">
                Generation failed
              </p>
              {report.error_message && (
                <p className="text-muted-foreground text-xs font-mono">
                  {report.error_message}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {report.content_md ?? ""}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
