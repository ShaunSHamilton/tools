import { useQuery } from '@tanstack/react-query'

export interface CurrentUser {
  id: string
  name: string
  email: string
  picture?: string | null
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/auth/me', { credentials: 'include' }).then(async r => {
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json() as Promise<CurrentUser>
    }),
    retry: false,
    staleTime: Infinity, // identity doesn't change mid-session
  })
}
