import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '../lib/api'

export interface TaskCollaborator {
  id: string
  name: string
  picture: string | null
}

export interface Task {
  id: string
  org_id: string
  assignee_id: string
  created_by: string
  title: string
  description: string | null
  url: string | null
  status: 'idea' | 'in_progress' | 'complete' | 'dropped'
  drop_reason: string | null
  color: string
  position: string
  upvote_count: number
  user_has_upvoted: boolean
  collaborators: TaskCollaborator[]
  created_at: string
  updated_at: string
}

export function useTasks(orgId: string) {
  return useQuery({
    queryKey: ['tasks', orgId],
    queryFn: () => apiFetch<Task[]>(`/api/orgs/${orgId}/tasks`),
    enabled: !!orgId,
  })
}

export function useCreateTask(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      assignee_id: string
      title: string
      description?: string
      url?: string | null
      color?: string
      collaborator_ids?: string[]
    }) =>
      apiFetch<Task>(`/api/orgs/${orgId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', orgId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateTask(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      ...body
    }: {
      taskId: string
      title?: string
      description?: string | null
      url?: string | null
      status?: string
      drop_reason?: string | null
      color?: string
      assignee_id?: string
      collaborator_ids?: string[]
    }) =>
      apiFetch<Task>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', orgId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpvoteTask(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<Task>(`/api/tasks/${taskId}/upvote`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', orgId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRemoveUpvote(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<Task>(`/api/tasks/${taskId}/upvote`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', orgId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useReorderTask(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      before_id,
      after_id,
    }: {
      taskId: string
      before_id?: string
      after_id?: string
    }) =>
      apiFetch(`/api/tasks/${taskId}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ before_id, after_id }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', orgId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteTask(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', orgId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}
