import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task } from '../hooks/useTasks'

const STATUS_LABELS: Record<Task['status'], string> = {
  idea: 'Idea',
  in_progress: 'In Progress',
  complete: 'Complete',
  dropped: 'Dropped',
}

const STATUS_COLORS: Record<Task['status'], string> = {
  idea: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
  in_progress: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950',
  complete: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950',
  dropped: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950',
}

interface Props {
  task: Task
  assigneeName?: string
  onClose: () => void
  onEdit: (task: Task) => void
}

export function TaskDetailModal({ task, assigneeName, onClose, onEdit }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div
            className="w-1.5 self-stretch rounded-full flex-shrink-0 min-h-5"
            style={{ backgroundColor: task.color }}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-snug break-words">
              {task.title}
            </h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[task.status]}`}
              >
                {STATUS_LABELS[task.status]}
              </span>
              {assigneeName && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {assigneeName}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors text-lg leading-none flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {task.description ? (
            <div className="text-sm text-gray-800 dark:text-gray-200">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 style={{ fontSize: '1.15em', fontWeight: 700, marginBottom: '0.5em', marginTop: '0.75em' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: '1.05em', fontWeight: 700, marginBottom: '0.4em', marginTop: '0.65em' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: '1em', fontWeight: 600, marginBottom: '0.35em', marginTop: '0.6em' }}>{children}</h3>,
                  p: ({ children }) => <p style={{ marginBottom: '0.6em', lineHeight: '1.6' }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ listStyleType: 'disc', paddingLeft: '1.4em', marginBottom: '0.6em' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ listStyleType: 'decimal', paddingLeft: '1.4em', marginBottom: '0.6em' }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: '0.2em', lineHeight: '1.5' }}>{children}</li>,
                  code: ({ children, className }) => {
                    const isBlock = className?.includes('language-')
                    return isBlock
                      ? <code style={{ display: 'block', background: 'rgba(0,0,0,0.07)', borderRadius: '5px', padding: '0.5em 0.75em', fontFamily: 'monospace', fontSize: '0.85em', overflowX: 'auto' }}>{children}</code>
                      : <code style={{ background: 'rgba(0,0,0,0.07)', borderRadius: '3px', padding: '0.1em 0.35em', fontFamily: 'monospace', fontSize: '0.85em' }}>{children}</code>
                  },
                  pre: ({ children }) => <pre style={{ marginBottom: '0.6em' }}>{children}</pre>,
                  blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #9ca3af', paddingLeft: '0.8em', color: '#6b7280', marginBottom: '0.6em', fontStyle: 'italic' }}>{children}</blockquote>,
                  a: ({ href, children }) => <a href={href} style={{ color: '#6366f1', textDecoration: 'underline' }} target="_blank" rel="noreferrer">{children}</a>,
                  strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                  em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0.75em 0' }} />,
                  table: ({ children }) => <div style={{ overflowX: 'auto', marginBottom: '0.6em' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85em' }}>{children}</table></div>,
                  th: ({ children }) => <th style={{ border: '1px solid #d1d5db', padding: '0.35em 0.6em', background: 'rgba(0,0,0,0.05)', fontWeight: 600, textAlign: 'left' }}>{children}</th>,
                  td: ({ children }) => <td style={{ border: '1px solid #d1d5db', padding: '0.35em 0.6em' }}>{children}</td>,
                  input: ({ checked, disabled }) => (
                    <input type="checkbox" checked={checked} disabled={disabled ?? true} style={{ marginRight: '0.4em' }} readOnly />
                  ),
                }}
              >
                {task.description}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-600 italic">No description</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => { onClose(); onEdit(task) }}
            className="text-sm px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-100"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}
