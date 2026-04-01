import { useState } from 'react'
import { useMarkRead, useNotifications, useRespondToInvite } from './useNotifications'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data: notifications = [] } = useNotifications()
  const markRead = useMarkRead()
  const respond = useRespondToInvite()

  const unread = notifications.filter((n) => !n.read)

  function handleRespond(inviteId: string, notifId: string, action: 'accept' | 'decline') {
    respond.mutate({ inviteId, action })
    markRead.mutate(notifId)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-gray-400 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-20 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Notifications</p>
              {unread.length > 0 && (
                <span className="text-xs text-blue-500 font-medium">{unread.length} new</span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">No notifications</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
                {notifications.map((n) => {
                  const payload = n.payload
                  return <li
                    key={n.id}
                    className={`px-4 py-3 transition-colors ${
                      n.read ? 'opacity-50' : 'bg-blue-50/50 dark:bg-blue-950/20'
                    }`}
                  >
                    {payload.type === 'org_invite' && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          <span className="font-medium">{payload.invited_by}</span>
                          {' invited you to '}
                          <span className="font-medium">{payload.org_name}</span>
                        </p>
                        {!n.read && (
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleRespond(payload.invitation_id, n.id, 'accept')
                              }
                              className="text-xs px-3 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-100"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() =>
                                handleRespond(payload.invitation_id, n.id, 'decline')
                              }
                              className="text-xs px-3 py-1 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {payload.type === 'task_upvoted' && (
                      <div className="space-y-1">
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          <span className="font-medium">{payload.upvoted_by}</span>
                          {' upvoted '}
                          <span className="font-medium">{payload.task_title}</span>
                        </p>
                        {!n.read && (
                          <button
                            onClick={() => markRead.mutate(n.id)}
                            className="text-xs px-3 py-1 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    )}

                    {payload.type === 'suggestion_added' && (
                      <div className="space-y-1">
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          <span className="font-medium">{payload.suggested_by}</span>
                          {' suggested on '}
                          <span className="font-medium">{payload.task_title}</span>
                          {': '}
                          <span className="text-gray-600 dark:text-gray-400">{payload.suggestion_content}</span>
                        </p>
                        {!n.read && (
                          <button
                            onClick={() => markRead.mutate(n.id)}
                            className="text-xs px-3 py-1 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    )}

                    {payload.type === 'report_generated' && (
                      <div className="space-y-1">
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          {'Your report '}
                          <span className="font-medium">{payload.report_title}</span>
                          {' has finished generating.'}
                        </p>
                        {!n.read && (
                          <div className="flex gap-2">
                            <a
                              href={`/task-tracker/reports/${payload.report_id}`}
                              onClick={() => markRead.mutate(n.id)}
                              className="text-xs px-3 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-100"
                            >
                              View report
                            </a>
                            <button
                              onClick={() => markRead.mutate(n.id)}
                              className="text-xs px-3 py-1 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {payload.type === 'app_release' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                            v{payload.version}
                          </span>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            New release
                          </p>
                        </div>
                        <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
                          {payload.notes}
                        </pre>
                        {!n.read && (
                          <button
                            onClick={() => markRead.mutate(n.id)}
                            className="text-xs px-3 py-1 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
