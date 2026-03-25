import { useEffect, useState } from 'react'

interface Props {
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export function DropReasonModal({ onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Drop this task?
        </h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          A reason is required to mark a task as dropped.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 resize-none"
            placeholder="Why is this task being dropped?"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm px-4 py-2 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="text-sm px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-500 disabled:opacity-50"
            >
              Drop task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
