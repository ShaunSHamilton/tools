import { useState, useEffect, useRef } from 'react'
import { useOrgs, type Org } from '@/hooks/useOrgs'

const STORAGE_KEY = 'selected_org_id'

function getStoredOrgId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storeOrgId(id: string | null) {
  try {
    if (id === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // ignore
  }
}

export function ExamOrgSwitcher() {
  const { data: orgs = [], isLoading } = useOrgs()
  const [selectedId, setSelectedId] = useState<string | null>(() => getStoredOrgId())
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Sync selectedId with stored value when orgs load
  useEffect(() => {
    if (orgs.length === 0) return
    const stored = getStoredOrgId()
    if (stored && orgs.some((o) => o.id === stored)) {
      setSelectedId(stored)
    } else {
      const first = orgs[0].id
      setSelectedId(first)
      storeOrgId(first)
    }
  }, [orgs])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(org: Org) {
    setSelectedId(org.id)
    storeOrgId(org.id)
    setOpen(false)
  }

  if (isLoading || orgs.length === 0) return null

  const current = orgs.find((o) => o.id === selectedId) ?? orgs[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors px-2 py-1 rounded-md hover:bg-teal-50 dark:hover:bg-teal-950/40"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-32 truncate">{current.name}</span>
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-md py-1">
          {orgs.map((org) => (
            <button
              key={org.id}
              role="option"
              aria-selected={org.id === current.id}
              onClick={() => select(org)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                org.id === current.id
                  ? 'text-gray-900 dark:text-white font-medium bg-gray-50 dark:bg-gray-800'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
