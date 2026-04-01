import { useContext, type ReactNode } from 'react'
import { AuthContext } from '../contexts/auth'
import { NavBar } from '@/components/nav-bar'
import { NotificationBell } from '@/components/notifications/NotificationBell'

export function ExamLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useContext(AuthContext)!
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar
        appName="Exam Creator"
        color="teal"
        appHref="/exam-creator"
        userName={user?.name}
        onLogout={logout}
      >
        <NotificationBell />
      </NavBar>
      {children}
    </div>
  )
}
