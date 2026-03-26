import { useQuery } from '@tanstack/react-query'

export interface CurrentUser {
  id: string
  name: string
  email: string
  picture?: string | null
  display_name?: string | null
  show_live_cursors: boolean
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

/** Returns the user's effective display name: display_name if set, else name. */
export function effectiveName(user: Pick<CurrentUser, 'name' | 'display_name'>): string {
  return user.display_name?.trim() || user.name
}
