import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/task-tracker/components/ui/card";
import { shareApi } from "@/task-tracker/lib/api";

export function SharePage() {
  const { token } = useParams({ from: "/task-tracker/share/$token" });

  const { data: report, isLoading } = useQuery({
    queryKey: ["share", token],
    queryFn: () => shareApi.get(token!),
    enabled: !!token,
    retry: false,
  });

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !report ? (
          <p className="text-muted-foreground text-sm">Report not found.</p>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-semibold">{report.title}</h1>
              <p className="text-muted-foreground text-sm">
                {report.period_start} – {report.period_end}
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {report.content_md ?? ""}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
