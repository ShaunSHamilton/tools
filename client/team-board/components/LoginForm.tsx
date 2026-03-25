import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { CurrentUser } from '../hooks/useCurrentUser'

export function LoginForm() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-xl border border-gray-200 dark:border-gray-800 w-full max-w-sm space-y-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Sign in</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">freeCodeCamp staff only</p>
        </div>

        <a
          href="/api/auth/github/login"
          className="flex items-center justify-center gap-2.5 w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
        >
          <GitHubIcon />
          Sign in with GitHub
        </a>

        {window.location.hostname === 'localhost' && <DevLoginForm />}
      </div>
    </div>
  )
}

function DevLoginForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `${res.status}`)
      const user = await res.json() as CurrentUser
      queryClient.setQueryData(['me'], user)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
      <p className="text-xs text-gray-400 dark:text-gray-500">dev login</p>

      <div className="space-y-1">
        <label className="block text-sm text-gray-500 dark:text-gray-400" htmlFor="dev-name">
          Name
        </label>
        <input
          id="dev-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm text-gray-500 dark:text-gray-400" htmlFor="dev-email">
          Email
        </label>
        <input
          id="dev-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
        />
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Signing in…' : 'Sign in (dev)'}
      </button>
    </form>
  )
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}
