import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { NavBar } from "@/components/nav-bar";

// ─── Auth/User (universal endpoint) ──────────────────────────────────────────

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  display_name?: string | null;
  show_live_cursors: boolean;
}

function effectiveName(user: Pick<CurrentUser, "name" | "display_name">) {
  return user.display_name?.trim() || user.name;
}

function fetchMe(): Promise<CurrentUser> {
  return fetch("/api/auth/me", { credentials: "include" }).then(async (r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });
}

function patchMe(body: { display_name?: string | null; show_live_cursors?: boolean }) {
  return fetch("/api/auth/me", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? `${r.status}`);
    }
    return r.json();
  });
}

// ─── Exam Creator database setting ───────────────────────────────────────────

type DbEnv = "Production" | "Staging";

interface ExamSession {
  settings?: { databaseEnvironment?: DbEnv };
}

function fetchExamSession(): Promise<ExamSession> {
  return fetch("/exam-creator/api/users/session", { credentials: "include" }).then(async (r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });
}

function putExamDbEnv(env: DbEnv): Promise<{ databaseEnvironment: DbEnv }> {
  return fetch("/exam-creator/api/users/session/settings", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ databaseEnvironment: env }),
  }).then(async (r) => {
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? `${r.status}`);
    }
    return r.json();
  });
}

// ─── Theme ───────────────────────────────────────────────────────────────────

const THEME_KEY = "team-board-theme";
type Theme = "light" | "dark";

function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: Theme) {
  const html = document.documentElement;
  if (t === "dark") html.classList.add("dark");
  else html.classList.remove("dark");
  localStorage.setItem(THEME_KEY, t);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "general" | "team-board" | "exam-creator";

// ─── Settings Page ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("general");

  const { data: user, status } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: Infinity,
  });

  const { data: examSession } = useQuery({
    queryKey: ["exam-session"],
    queryFn: fetchExamSession,
    retry: false,
  });

  const [theme, setTheme] = useState<Theme>(() => getTheme());
  const [displayName, setDisplayName] = useState("");
  const [showCursors, setShowCursors] = useState(true);
  const [initialised, setInitialised] = useState(false);

  // Initialise form state once user data loads
  if (status === "success" && !initialised) {
    setDisplayName(user.display_name ?? "");
    setShowCursors(user.show_live_cursors);
    setInitialised(true);
  }

  const generalMutation = useMutation({
    mutationFn: (body: { display_name?: string | null }) => patchMe(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Settings saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const tbMutation = useMutation({
    mutationFn: (body: { show_live_cursors: boolean }) => patchMe(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Settings saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dbMutation = useMutation({
    mutationFn: (env: DbEnv) => putExamDbEnv(env),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["exam-session"] });
      toast.success(`Switched to ${data.databaseEnvironment} database`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // best-effort
    }
    qc.clear();
    navigate({ to: "/login" });
  }

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  function handleGeneralSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed && trimmed.length > 50) {
      toast.error("Display name must be 50 characters or fewer");
      return;
    }
    generalMutation.mutate({ display_name: trimmed || null });
  }

  function handleTBSubmit(e: React.FormEvent) {
    e.preventDefault();
    tbMutation.mutate({ show_live_cursors: showCursors });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "team-board", label: "Team Board" },
    { id: "exam-creator", label: "Exam Creator" },
  ];

  const currentDbEnv: DbEnv =
    examSession?.settings?.databaseEnvironment ?? "Production";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
      <NavBar
        appName="Settings"
        appHref="/settings"
        userName={user ? effectiveName(user) : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Settings</h1>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`pb-2.5 px-1 mr-4 text-sm capitalize transition-colors border-b-2 -mb-px ${
                  tab === t.id
                    ? "border-gray-900 dark:border-white text-gray-900 dark:text-white font-medium"
                    : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {status === "pending" && (
            <div className="space-y-4">
              <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
              <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
            </div>
          )}

          {status === "error" && (
            <p className="text-sm text-red-500">Failed to load user settings.</p>
          )}

          {status === "success" && user && (
            <>
              {/* ── General ── */}
              {tab === "general" && (
                <form onSubmit={handleGeneralSubmit} className="space-y-5">
                  {/* Display Name */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                    <label
                      htmlFor="display-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                    >
                      Display name
                    </label>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                      Shown across all apps instead of your GitHub name. Currently shown as:{" "}
                      <span className="font-medium text-gray-600 dark:text-gray-300">
                        {effectiveName(user)}
                      </span>
                    </p>
                    <input
                      id="display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={50}
                      placeholder={user.name}
                      className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1.5">
                      Leave blank to use your GitHub name ({user.name}). Max 50 characters.
                    </p>
                  </div>

                  {/* Theme */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Theme</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          Choose light or dark appearance.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={toggleTheme}
                        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                        className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                        aria-label="Toggle theme"
                      >
                        {theme === "dark" ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="4" strokeWidth="1.5" />
                            <path strokeWidth="1.5" strokeLinecap="round"
                              d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                              d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={generalMutation.isPending}
                      className="text-sm px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    >
                      {generalMutation.isPending ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              )}

              {/* ── Team Board ── */}
              {tab === "team-board" && (
                <form onSubmit={handleTBSubmit} className="space-y-5">
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          Live cursors
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          When enabled, your cursor is visible to teammates and theirs to you.
                          Disabling stops sending and receiving cursor positions entirely.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={showCursors}
                        onClick={() => setShowCursors((v) => !v)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                          showCursors
                            ? "bg-gray-900 dark:bg-white"
                            : "bg-gray-300 dark:bg-gray-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-900 shadow ring-0 transition duration-200 ease-in-out ${
                            showCursors ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={tbMutation.isPending}
                      className="text-sm px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    >
                      {tbMutation.isPending ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              )}

              {/* ── Exam Creator ── */}
              {tab === "exam-creator" && (
                <div className="space-y-5">
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Database environment
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                      Controls which database is used when viewing exams, attempts, and metrics.
                    </p>
                    <div className="flex gap-3">
                      {(["Production", "Staging"] as DbEnv[]).map((env) => {
                        const isActive = currentDbEnv === env;
                        const badgeColor =
                          env === "Production"
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
                        const subtext =
                          env === "Production" ? "Live data" : "Test data";
                        return (
                          <button
                            key={env}
                            disabled={isActive || dbMutation.isPending}
                            onClick={() => dbMutation.mutate(env)}
                            className={`flex-1 flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-sm transition-colors disabled:opacity-60 ${
                              isActive
                                ? `${badgeColor} cursor-default`
                                : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                          >
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                env === "Production"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-yellow-500/20 text-yellow-400"
                              }`}
                            >
                              {env}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">
                              {subtext}
                            </span>
                            {isActive && (
                              <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                Currently active
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {dbMutation.isPending && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Switching…</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
