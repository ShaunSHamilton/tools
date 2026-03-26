import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '../lib/api'

export interface SuggestionAuthor {
  id: string
  name: string
  picture: string | null
  display_name: string | null
}

export interface Suggestion {
  id: string
  task_id: string
  org_id: string
  created_by: string
  content: string
  vote_count: number
  user_has_voted: boolean
  dismissed: boolean
  position: string
  author: SuggestionAuthor
  created_at: string
  updated_at: string
}

export function useSuggestions(taskId: string | null) {
  return useQuery({
    queryKey: ['suggestions', taskId],
    queryFn: () => apiFetch<Suggestion[]>(`/api/tasks/${taskId}/suggestions`),
    enabled: !!taskId,
  })
}

export function useCreateSuggestion(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { content: string }) =>
      apiFetch<Suggestion>(`/api/tasks/${taskId}/suggestions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions', taskId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteSuggestion(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (suggestionId: string) =>
      apiFetch(`/api/suggestions/${suggestionId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions', taskId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDismissSuggestion(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (suggestionId: string) =>
      apiFetch<Suggestion>(`/api/suggestions/${suggestionId}/dismiss`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions', taskId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useVoteSuggestion(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (suggestionId: string) =>
      apiFetch<Suggestion>(`/api/suggestions/${suggestionId}/vote`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions', taskId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRemoveVoteSuggestion(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (suggestionId: string) =>
      apiFetch<Suggestion>(`/api/suggestions/${suggestionId}/vote`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions', taskId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useReorderSuggestion(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      suggestionId,
      before_id,
      after_id,
    }: {
      suggestionId: string
      before_id?: string
      after_id?: string
    }) =>
      apiFetch(`/api/suggestions/${suggestionId}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ before_id, after_id }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions', taskId] }),
    onError: (err: Error) => toast.error(err.message),
  })
}
