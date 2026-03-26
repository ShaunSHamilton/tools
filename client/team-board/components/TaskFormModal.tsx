import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task } from '../hooks/useTasks'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#a3a3a3',
]

export interface ModalMember {
  id: string
  name: string
  picture?: string | null
}

interface Props {
  task?: Task | null
  orgId: string
  members?: ModalMember[]
  onSave: (data: {
    title: string
    description: string | null
    url: string | null
    color: string
    collaborator_ids: string[]
  }) => Promise<void>
  onClose: () => void
  isSaving: boolean
}

export function TaskFormModal({ task, onSave, onClose, isSaving, members = [] }: Props) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [url, setUrl] = useState(task?.url ?? '')
  const [color, setColor] = useState(task?.color ?? '#6366f1')
  const [descTab, setDescTab] = useState<'edit' | 'preview'>('edit')
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(
    task?.collaborators?.map((c) => c.id) ?? [],
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function toggleCollaborator(id: string) {
    setCollaboratorIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setError(null)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        url: url.trim() || null,
        color,
        collaborator_ids: collaboratorIds,
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          {task ? 'Edit task' : 'New task'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
              placeholder="Task title"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Description</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setDescTab('edit')}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                    descTab === 'edit'
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDescTab('preview')}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                    descTab === 'preview'
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>
            {descTab === 'edit' ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 resize-none font-mono"
                placeholder="Optional description (supports Markdown)"
              />
            ) : (
              <div className="min-h-[6rem] bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white overflow-auto">
                {description.trim() ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 style={{ fontSize: '1.1em', fontWeight: 700, marginBottom: '0.4em' }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ fontSize: '1em', fontWeight: 700, marginBottom: '0.3em' }}>{children}</h2>,
                      h3: ({ children }) => <h3 style={{ fontSize: '0.95em', fontWeight: 600, marginBottom: '0.25em' }}>{children}</h3>,
                      p: ({ children }) => <p style={{ marginBottom: '0.5em' }}>{children}</p>,
                      ul: ({ children }) => <ul style={{ listStyleType: 'disc', paddingLeft: '1.2em', marginBottom: '0.5em' }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ listStyleType: 'decimal', paddingLeft: '1.2em', marginBottom: '0.5em' }}>{children}</ol>,
                      li: ({ children }) => <li style={{ marginBottom: '0.15em' }}>{children}</li>,
                      code: ({ children, className }) => {
                        const isBlock = className?.includes('language-')
                        return isBlock
                          ? <code style={{ display: 'block', background: 'rgba(0,0,0,0.08)', borderRadius: '4px', padding: '0.4em 0.6em', fontFamily: 'monospace', fontSize: '0.85em', marginBottom: '0.4em', overflowX: 'auto' }}>{children}</code>
                          : <code style={{ background: 'rgba(0,0,0,0.08)', borderRadius: '3px', padding: '0.1em 0.35em', fontFamily: 'monospace', fontSize: '0.85em' }}>{children}</code>
                      },
                      pre: ({ children }) => <pre style={{ marginBottom: '0.5em' }}>{children}</pre>,
                      blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #9ca3af', paddingLeft: '0.75em', color: '#6b7280', marginBottom: '0.5em' }}>{children}</blockquote>,
                      a: ({ href, children }) => <a href={href} style={{ color: '#6366f1', textDecoration: 'underline' }} target="_blank" rel="noreferrer">{children}</a>,
                      strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                      em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                      hr: () => <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0.5em 0' }} />,
                      table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0.5em', fontSize: '0.85em' }}>{children}</table>,
                      th: ({ children }) => <th style={{ border: '1px solid #d1d5db', padding: '0.3em 0.5em', background: 'rgba(0,0,0,0.05)', fontWeight: 600 }}>{children}</th>,
                      td: ({ children }) => <td style={{ border: '1px solid #d1d5db', padding: '0.3em 0.5em' }}>{children}</td>,
                    }}
                  >
                    {description}
                  </ReactMarkdown>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 italic">Nothing to preview</span>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
              placeholder="https://…"
            />
          </div>
          {members.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">
                Collaborators
              </label>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const selected = collaboratorIds.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleCollaborator(m.id)}
                      className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-colors ${
                        selected
                          ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {m.picture ? (
                          <img src={m.picture} alt={m.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] font-medium text-gray-600 dark:text-gray-300 uppercase">
                            {m.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <span>{m.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? 'white' : 'transparent',
                    boxShadow: color === c ? '0 0 0 1px #9ca3af' : undefined,
                  }}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-2 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="text-sm px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : task ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
