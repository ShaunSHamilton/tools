import { useState } from 'react'
import { useCreateOrg, useOrgs, type Org } from '../hooks/useOrgs'

interface Props {
  selectedOrgId: string | null
  onSelect: (org: Org) => void
}

export function OrgSwitcher({ selectedOrgId, onSelect }: Props) {
  const { data: orgs = [], isLoading } = useOrgs()
  const createOrg = useCreateOrg()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const org = await createOrg.mutateAsync(newName.trim())
      setNewName('')
      setCreating(false)
      onSelect(org)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[0, 1].map((i) => (
          <div key={i} className="h-8 rounded animate-pulse bg-gray-200 dark:bg-gray-800" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orgs.length === 0 && !creating && (
        <p className="text-xs text-gray-400 dark:text-gray-600">No organisations yet.</p>
      )}

      {orgs.length > 0 && (
        <ul className="space-y-0.5">
          {orgs.map((org) => (
            <li key={org.id}>
              <button
                onClick={() => onSelect(org)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  org.id === selectedOrgId
                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50'
                }`}
              >
                {org.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <form onSubmit={handleCreate} className="space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Organisation name"
            required
            autoFocus
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
          />
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createOrg.isPending}
              className="text-xs px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setError(null) }}
              className="text-xs px-3 py-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          + New organisation
        </button>
      )}
    </div>
  )
}
