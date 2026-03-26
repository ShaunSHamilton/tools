import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useCurrentUser, effectiveName } from './hooks/useCurrentUser'
import { useTheme } from './hooks/useTheme'
import { NotificationBell } from './components/NotificationBell'
import { OrgSwitcher } from './components/OrgSwitcher'
import { BoardView } from './components/BoardView'
import { OrgPage } from './components/OrgPage'
import { ConnectionStatus } from './components/ConnectionStatus'
import { ThemeToggle } from './components/ThemeToggle'
import type { Org } from './hooks/useOrgs'
import { useOrgDetail } from './hooks/useOrgs'
import type { CurrentUser } from './hooks/useCurrentUser'

function App() {
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: user, status } = useCurrentUser()
  const { theme, toggleTheme } = useTheme()

  // Close sidebar when org is selected on mobile
  function handleSelectOrg(org: Org) {
    setSelectedOrg(org)
    setSidebarOpen(false)
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // best-effort
    }
    queryClient.clear()
    navigate({ to: '/login' })
  }

  if (status === 'pending') return <LoadingScreen />
  if (status === 'error') return <Navigate to="/login" />

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900 dark:text-white">Team Board</span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <ConnectionStatus />
          <NotificationBell />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <span className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
            {effectiveName(user)}
          </span>
          <Link
            to="/team-board/settings"
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-30 w-56 bg-gray-50 dark:bg-gray-950
            border-r border-gray-200 dark:border-gray-800 p-4 flex-shrink-0
            overflow-y-auto transition-transform duration-200
            md:static md:translate-x-0 md:z-auto
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          {/* Close button — mobile only */}
          <button
            className="md:hidden mb-3 text-gray-400 hover:text-gray-900 dark:hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Organisations
          </p>
          <OrgSwitcher selectedOrgId={selectedOrg?.id ?? null} onSelect={handleSelectOrg} />
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col min-w-0">
          {selectedOrg ? (
            <OrgMain orgId={selectedOrg.id} currentUser={user} />
          ) : (
            <EmptyOrgState />
          )}
        </main>
      </div>
    </div>
  )
}

type OrgTab = 'board' | 'organisation'

function OrgMain({
  orgId,
  currentUser,
}: {
  orgId: string
  currentUser: CurrentUser
}) {
  const [tab, setTab] = useState<OrgTab>('board')
  const { data, isLoading } = useOrgDetail(orgId)

  // Reset tab when org changes
  useEffect(() => { setTab('board') }, [orgId])

  if (isLoading || !data) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Loading…</p>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200 dark:border-gray-800 -mx-4 md:-mx-6 px-4 md:px-6">
        {(['board', 'organisation'] as OrgTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2.5 px-1 text-sm capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white font-medium'
                : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t === 'board' ? 'Board' : 'Organisation'}
          </button>
        ))}
      </div>

      {tab === 'board' ? (
        data.members.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No members yet.</p>
            <p className="text-gray-300 dark:text-gray-600 text-xs">
              Go to the Organisation tab to invite colleagues.
            </p>
          </div>
        ) : (
          <BoardView orgId={orgId} members={data.members} currentUserId={currentUser.id} />
        )
      ) : (
        <div className="overflow-y-auto flex-1">
          <OrgPage orgId={orgId} currentUser={currentUser} />
        </div>
      )}
    </div>
  )
}

function EmptyOrgState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
      <svg className="w-10 h-10 text-gray-200 dark:text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
          d="M3 7h18M3 12h18M3 17h18" />
      </svg>
      <p className="text-gray-500 dark:text-gray-600 text-sm">
        Select or create an organisation to get started.
      </p>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <p className="text-gray-400 dark:text-gray-500 text-sm">Loading…</p>
    </div>
  )
}

export default App
