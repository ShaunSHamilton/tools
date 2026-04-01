import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// Shared fetch for the unified /api/* endpoints (no app-specific prefix).
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export interface Org {
  id: string
  name: string
  slug: string
  created_by: string
}

export interface OrgMember {
  user: { id: string; name: string; email: string; display_name?: string | null }
  role: 'admin' | 'member'
  joined_at: string
}

export interface OrgDetail {
  org: Org
  members: OrgMember[]
}

export interface OrgInvitation {
  id: string
  invited_email: string
  invited_by: string
  created_at: string
}

export function useOrgs() {
  return useQuery({
    queryKey: ['orgs'],
    queryFn: () => apiFetch<Org[]>('/api/orgs'),
  })
}

export function useOrgDetail(orgId: string) {
  return useQuery({
    queryKey: ['orgs', orgId],
    queryFn: () => apiFetch<OrgDetail>(`/api/orgs/${orgId}`),
    enabled: !!orgId,
  })
}

export function useCreateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Org>('/api/orgs', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgs'] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useInviteMember(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch(`/api/orgs/${orgId}/members/invite`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgs', orgId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRemoveMember(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/orgs/${orgId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgs', orgId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useOrgInvitations(orgId: string) {
  return useQuery({
    queryKey: ['orgs', orgId, 'invitations'],
    queryFn: () => apiFetch<OrgInvitation[]>(`/api/orgs/${orgId}/invitations`),
    enabled: !!orgId,
  })
}

export function useCancelInvitation(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch(`/api/orgs/${orgId}/invitations/${inviteId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgs', orgId, 'invitations'] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useChangeRole(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'member' }) =>
      apiFetch(`/api/orgs/${orgId}/members/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgs', orgId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}
