import { useState } from 'react'
import { toast } from 'sonner'
import {
  useCancelInvitation,
  useChangeRole,
  useInviteMember,
  useOrgDetail,
  useOrgInvitations,
  useRemoveMember,
} from '../hooks/useOrgs'
import type { CurrentUser } from '../hooks/useCurrentUser'
import { Skeleton } from './Skeleton'

interface Props {
  orgId: string
  currentUser: CurrentUser
}

const ROLE_BADGE: Record<string, string> = {
  admin:
    'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800',
  member:
    'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
}

const INVITED_BADGE =
  'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'

export function OrgPage({ orgId, currentUser }: Props) {
  const { data, isLoading: loadingOrg } = useOrgDetail(orgId)
  const { data: invitations = [], isLoading: loadingInvites } = useOrgInvitations(orgId)
  const invite = useInviteMember(orgId)
  const remove = useRemoveMember(orgId)
  const changeRole = useChangeRole(orgId)
  const cancelInvite = useCancelInvitation(orgId)

  const [inviteEmail, setInviteEmail] = useState('')

  if (loadingOrg || !data) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    )
  }

  const { org, members } = data
  const me = members.find((m) => m.user.id === currentUser.id)
  const isAdmin = me?.role === 'admin'

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const email = inviteEmail.trim()
    if (!email) return
    try {
      await invite.mutateAsync(email)
      setInviteEmail('')
      toast.success(`Invitation sent to ${email}`)
    } catch {
      // error already toasted by mutation onError
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{org.name}</h2>

      {/* ── Members ─────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
          Members · {members.length}
        </h3>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          {members.map((m) => {
            const isMe = m.user.id === currentUser.id
            return (
              <li
                key={m.user.id}
                className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {/* Left: avatar initial + name + email */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">
                      {m.user.name.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {m.user.name}
                      {isMe && (
                        <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-600 font-normal">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {m.user.email}
                    </p>
                  </div>
                </div>

                {/* Right: role badge + actions */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_BADGE[m.role]}`}
                  >
                    {m.role}
                  </span>
                  {isAdmin && !isMe && (
                    <>
                      <button
                        onClick={() =>
                          changeRole.mutate({
                            userId: m.user.id,
                            role: m.role === 'admin' ? 'member' : 'admin',
                          })
                        }
                        disabled={changeRole.isPending}
                        className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-40"
                      >
                        {m.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${m.user.name} from this organisation?`)) {
                            remove.mutate(m.user.id)
                          }
                        }}
                        disabled={remove.isPending}
                        className="text-xs text-red-400 dark:text-red-700 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ── Pending Invitations ──────────────────────────────────────────── */}
      {isAdmin && (
        <section>
          <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Pending Invitations
            {invitations.length > 0 && (
              <span className="ml-2 text-amber-500">· {invitations.length}</span>
            )}
          </h3>

          {loadingInvites ? (
            <Skeleton className="h-14 w-full" />
          ) : invitations.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-600 py-2">
              No pending invitations.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-amber-600 dark:text-amber-400">?</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {inv.invited_email}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Invited by {inv.invited_by}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${INVITED_BADGE}`}>
                      invited
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Cancel invitation to ${inv.invited_email}?`)) {
                          cancelInvite.mutate(inv.id)
                        }
                      }}
                      disabled={cancelInvite.isPending}
                      className="text-xs text-red-400 dark:text-red-700 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Invite form ──────────────────────────────────────────────────── */}
      {isAdmin && (
        <section>
          <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Invite by email
          </h3>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
              className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 placeholder-gray-400 dark:placeholder-gray-600"
            />
            <button
              type="submit"
              disabled={invite.isPending}
              className="text-sm px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 whitespace-nowrap"
            >
              {invite.isPending ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
