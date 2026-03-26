import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCurrentUser, effectiveName } from '../hooks/useCurrentUser'
import { useTheme } from '../hooks/useTheme'
import { ThemeToggle } from '../components/ThemeToggle'

interface UpdateMeBody {
  display_name?: string | null
  show_live_cursors?: boolean
}

function updateMe(body: UpdateMeBody) {
  return fetch('/api/auth/me', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (r) => {
    if (!r.ok) {
      const data = await r.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error ?? `${r.status}`)
    }
    return r.json()
  })
}

export function SettingsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: user, status } = useCurrentUser()
  const { theme, toggleTheme } = useTheme()

  const [displayName, setDisplayName] = useState<string>('')
  const [showCursors, setShowCursors] = useState<boolean>(true)
  const [initialised, setInitialised] = useState(false)

  // Initialise local form state once user data is available
  if (status === 'success' && !initialised) {
    setDisplayName(user.display_name ?? '')
    setShowCursors(user.show_live_cursors)
    setInitialised(true)
  }

  const mutation = useMutation({
    mutationFn: (body: UpdateMeBody) => updateMe(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('Settings saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // best-effort
    }
    qc.clear()
    navigate({ to: '/login' })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = displayName.trim()
    if (trimmed && trimmed.length > 50) {
      toast.error('Display name must be 50 characters or fewer')
      return
    }
    mutation.mutate({
      display_name: trimmed || null,
      show_live_cursors: showCursors,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/team-board"
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            Team Board
          </Link>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          {user && (
            <span className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
              {effectiveName(user)}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Settings</h1>

          {status === 'pending' && (
            <div className="space-y-4">
              <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
              <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
            </div>
          )}

          {status === 'error' && (
            <p className="text-sm text-red-500">Failed to load user settings.</p>
          )}

          {status === 'success' && user && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Display Name */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <label
                  htmlFor="display-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  Display name
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  Shown instead of your GitHub name. Currently shown as:{' '}
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

              {/* Live Cursors Toggle */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Live cursors
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      When enabled, your cursor is visible to teammates and theirs to you. Disabling
                      stops sending and receiving cursor positions entirely.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showCursors}
                    onClick={() => setShowCursors((v) => !v)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      showCursors
                        ? 'bg-gray-900 dark:bg-white'
                        : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-900 shadow ring-0 transition duration-200 ease-in-out ${
                        showCursors ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="text-sm px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                  {mutation.isPending ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
