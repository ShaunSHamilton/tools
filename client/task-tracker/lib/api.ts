const BASE = "/task-tracker";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

export const auth = {
  me: () => request<User>("/auth/me"),

  logout: () => request<void>("/auth/logout", { method: "POST" }),
};

// ─── GitHub ───────────────────────────────────────────────────────────────────

export interface GithubConnection {
  github_username: string;
  scopes: string[];
  connected_at: string;
}

export interface GithubStatusResponse {
  connected: false;
  connection?: undefined;
}

export interface GithubStatusConnected {
  connected: true;
  connection: GithubConnection;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface ReportSummary {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  status: "pending" | "generating" | "completed" | "failed";
  generated_at: string | null;
  created_at: string;
}

export interface Report extends ReportSummary {
  content_md: string | null;
  error_message: string | null;
  custom_instructions: string | null;
}

export const reports = {
  list: () => request<{ reports: ReportSummary[] }>("/reports"),

  get: (id: string) => request<Report>(`/reports/${id}`),

  create: (body: {
    period_start: string;
    period_end: string;
    custom_instructions?: string | null;
    org_ids?: string[];
  }) =>
    request<Report>("/reports", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  rename: (id: string, title: string) =>
    request<void>(`/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  delete: (id: string) =>
    request<void>(`/reports/${id}`, { method: "DELETE" }),

  getOrgs: (id: string) =>
    request<{ org_ids: string[] }>(`/reports/${id}/orgs`),

  updateOrgs: (id: string, org_ids: string[]) =>
    request<void>(`/reports/${id}/orgs`, {
      method: "PUT",
      body: JSON.stringify({ org_ids }),
    }),

  share: (id: string) =>
    request<{ url: string; token: string }>(`/reports/${id}/share`, {
      method: "POST",
    }),
};

// ─── Orgs ─────────────────────────────────────────────────────────────────────

export interface Org {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface OrgMember {
  user_id: string;
  email: string;
  name: string;
  picture: string | null;
  role: "admin" | "member";
  joined_at: string;
}

export interface OrgDetail {
  org: Org;
  members: OrgMember[];
  caller_role: "admin" | "member";
}

export interface OrgReportSummary {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  status: "pending" | "generating" | "completed" | "failed";
  generated_at: string | null;
  created_at: string;
  author_name: string;
}

export const orgs = {
  create: (body: { name: string }) =>
    request<Org>("/orgs", { method: "POST", body: JSON.stringify(body) }),

  list: () => request<{ orgs: Org[] }>("/orgs"),

  get: (slug: string) => request<OrgDetail>(`/orgs/${slug}`),

  invite: (slug: string, email: string) =>
    request<void>(`/orgs/${slug}/invites`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  acceptInvite: (inviteToken: string) =>
    request<Org>(`/orgs/invites/${inviteToken}/accept`, { method: "POST" }),

  listReports: (slug: string) =>
    request<{ reports: OrgReportSummary[] }>(`/orgs/${slug}/reports`),
};

export const shareApi = {
  get: (token: string) => request<Report>(`/share/${token}`),
};

export const github = {
  status: () =>
    request<GithubStatusResponse | GithubStatusConnected>("/github/status"),

  connectStart: () =>
    request<{ url: string }>("/github/connect/start", { method: "POST" }),
};
