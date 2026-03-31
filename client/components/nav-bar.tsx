import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

interface NavBarProps {
  appName: string;
  appHref: string;
  userName?: string;
  onLogout: () => void | Promise<void>;
  /** Extra items rendered between the app name and settings link (e.g. notification bell) */
  children?: ReactNode;
}

export function NavBar({ appName, appHref, userName, onLogout, children }: NavBarProps) {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0 bg-gray-50 dark:bg-gray-950">
      {/* Left: breadcrumb nav */}
      <nav className="flex items-center gap-1.5 text-sm min-w-0">
        <Link
          to="/"
          className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          Home
        </Link>
        <svg className="w-3 h-3 text-gray-300 dark:text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link
          to={appHref}
          className="font-medium text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-200 transition-colors truncate"
        >
          {appName}
        </Link>
      </nav>

      {/* Right: extra items + settings + user + logout */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {children}
        <Link
          to="/settings"
          className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Settings
        </Link>
        {userName && (
          <span className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
            {userName}
          </span>
        )}
        <button
          onClick={onLogout}
          className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
