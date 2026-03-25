import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '../lib/api'

export interface OrgInvitePayload {
  type: 'org_invite'
  invitation_id: string
  org_id: string
  org_name: string
  invited_by: string
}

export interface AppNotification {
  id: string
  read: boolean
  created_at: string
  payload: OrgInvitePayload // extend union as new types are added
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<AppNotification[]>('/api/notifications'),
    // WS pushes live updates; poll every 60s as a fallback
    refetchInterval: 60_000,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (notifId: string) =>
      apiFetch(`/api/notifications/${notifId}/read`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRespondToInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      inviteId,
      action,
    }: {
      inviteId: string
      action: 'accept' | 'decline'
    }) =>
      apiFetch(`/api/invitations/${inviteId}/${action}`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['orgs'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
