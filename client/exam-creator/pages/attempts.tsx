import { useNavigate, useSearch } from "@tanstack/react-router";
import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { ChevronDownIcon } from "lucide-react";
import { ExamEnvironmentExamModerationStatus } from "@prisma/client";

import { ModerationCard } from "../components/moderation-card";
import { UsersWebSocketActivityContext } from "../contexts/users-websocket";
import { AuthContext } from "../contexts/auth";
import { DatabaseStatus } from "../components/database-status";
import { moderationsInfiniteQuery } from "../hooks/queries";
import { Header } from "../components/ui/header";

export function Attempts() {
  const { logout } = useContext(AuthContext)!;
  const { updateActivity } = useContext(UsersWebSocketActivityContext)!;
  const navigate = useNavigate();
  const search = useSearch({ from: "/exam-creator/attempts" });

  const [moderationStatusFilter, setModerationStatusFilter] =
    useState<ExamEnvironmentExamModerationStatus>((search.filter as ExamEnvironmentExamModerationStatus) || "Pending");
  const [sort, setSort] = useState<number>(search.sort ?? 1);

  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const mods = moderationsInfiniteQuery({ moderationStatusFilter, sort });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (mods.isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && mods.hasNextPage) {
          mods.fetchNextPage();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [mods.isFetchingNextPage, mods.hasNextPage, mods.fetchNextPage],
  );

  useEffect(() => {
    updateActivity({
      page: new URL(window.location.href),
      lastActive: Date.now(),
    });
  }, []);

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="flex items-center fixed top-3 left-8 z-[101] gap-3">
        <DatabaseStatus />
        <button
          className="border border-teal-500 text-teal-500 hover:bg-teal-500/10 rounded-md px-3 py-1 text-sm font-medium"
          onClick={() => navigate({ to: "/exam-creator" })}
        >
          Back to Dashboard
        </button>
        <button
          className="border border-red-500 text-red-500 hover:bg-red-500/10 rounded-md px-3 py-1 text-sm font-medium"
          onClick={() => logout()}
        >
          Logout
        </button>
      </div>
      <div className="flex items-center justify-center">
        <div className="flex flex-col gap-8 w-full max-w-7xl">
          <Header title="Exam Moderator" description="Moderate exam attempts">
            <div className="flex items-center gap-2">
              {/* Moderation status filter */}
              <div className="relative">
                <button
                  className="bg-background text-foreground border border-border rounded-md px-4 py-1.5 flex items-center gap-1"
                  onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                >
                  {moderationStatusFilter}
                  <ChevronDownIcon size={16} />
                </button>
                {statusMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg min-w-[150px]">
                    {(["Pending", "Approved", "Denied"] as const).map((status) => (
                      <button
                        key={status}
                        className="w-full text-left px-4 py-2 hover:bg-muted font-bold disabled:opacity-50"
                        onClick={() => {
                          setModerationStatusFilter(status);
                          setStatusMenuOpen(false);
                        }}
                        disabled={mods.isPending || mods.isFetching}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Sort order */}
              <div className="relative">
                <button
                  className="bg-background text-foreground border border-border rounded-md px-4 py-1.5 flex items-center gap-1"
                  onClick={() => setSortMenuOpen(!sortMenuOpen)}
                >
                  {sort === 1 ? "Ascending" : "Descending"}
                  <ChevronDownIcon size={16} />
                </button>
                {sortMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg min-w-[150px]">
                    {(["Ascending", "Descending"] as const).map((name) => (
                      <button
                        key={name}
                        className="w-full text-left px-4 py-2 hover:bg-muted font-bold disabled:opacity-50"
                        onClick={() => {
                          setSort(name === "Ascending" ? 1 : -1);
                          setSortMenuOpen(false);
                        }}
                        disabled={mods.isPending || mods.isFetching}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Header>
          <div>
            {mods.isPending ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-400 border-t-transparent" />
              </div>
            ) : mods.isError ? (
              <div className="flex items-center justify-center">
                <p className="text-red-400 text-lg">
                  {mods.error.message}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8">
                {mods.isSuccess &&
                  mods.data.pages.flat().map((moderation, i, moderations) => {
                    const isLastCard = i === moderations.length - 1;
                    return (
                      <div
                        key={moderation.id}
                        ref={isLastCard ? lastCardRef : undefined}
                      >
                        <ModerationCard
                          moderation={moderation}
                          filter={moderationStatusFilter}
                        />
                      </div>
                    );
                  })}
                {mods.data?.pages?.length === 0 && (
                  <div className="flex items-center justify-center">
                    <p className="text-muted-foreground text-lg">
                      No moderations found for "{moderationStatusFilter}"
                      status.
                    </p>
                  </div>
                )}
              </div>
            )}
            {mods.isFetchingNextPage && (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-400 border-t-transparent" />
              </div>
            )}
            {!mods.isFetchingNextPage &&
              mods.isSuccess &&
              !mods.hasNextPage && (
                <div className="flex items-center justify-center py-6">
                  <p className="text-muted-foreground text-base">
                    No more moderations to load.
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
