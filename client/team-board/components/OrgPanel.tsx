import { useState } from 'react'
import {
  useChangeRole,
  useInviteMember,
  useOrgDetail,
  useRemoveMember,
} from '@/hooks/useOrgs'
import type { CurrentUser } from '../hooks/useCurrentUser'

interface Props {
  orgId: string
  currentUser: CurrentUser
}

export function OrgPanel({ orgId, currentUser }: Props) {
  const { data, isLoading } = useOrgDetail(orgId)
  const invite = useInviteMember(orgId)
  const remove = useRemoveMember(orgId)
  const changeRole = useChangeRole(orgId)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState(false)

  if (isLoading || !data) {
    return <p className="text-sm text-gray-500">Loading…</p>
  }

  const { org, members } = data
  const me = members.find(m => m.user.id === currentUser.id)
  const isAdmin = me?.role === 'admin'

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSent(false)
    try {
      await invite.mutateAsync(inviteEmail.trim())
      setInviteEmail('')
      setInviteSent(true)
    } catch (err) {
      setInviteError((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">{org.name}</h2>

      {/* Members */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Members
        </h3>
        <ul className="space-y-2">
          {members.map(m => (
            <li key={m.user.id} className="flex items-center justify-between">
              <div>
                <span className="text-sm text-white">{m.user.name}</span>
                <span className="ml-2 text-xs text-gray-500">{m.user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 capitalize">{m.role}</span>
                {isAdmin && m.user.id !== currentUser.id && (
                  <>
                    <button
                      onClick={() =>
                        changeRole.mutate({
                          userId: m.user.id,
                          role: m.role === 'admin' ? 'member' : 'admin',
                        })
                      }
                      className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                    >
                      {m.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                    <button
                      onClick={() => remove.mutate(m.user.id)}
                      className="text-xs text-red-700 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Invite (admin only) */}
      {isAdmin && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Invite by email
          </h3>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
              className="flex-1 bg-gray-800 text-white border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500 placeholder-gray-600"
            />
            <button
              type="submit"
              disabled={invite.isPending}
              className="text-sm px-4 py-1.5 bg-white text-gray-900 rounded font-medium hover:bg-gray-100 disabled:opacity-50"
            >
              Invite
            </button>
          </form>
          {inviteError && <p className="text-xs text-red-400 mt-1">{inviteError}</p>}
          {inviteSent && (
            <p className="text-xs text-green-500 mt-1">Invitation sent.</p>
          )}
        </div>
      )}
    </div>
  )
}
