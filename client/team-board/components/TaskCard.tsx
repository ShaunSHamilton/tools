import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task } from '../hooks/useTasks'
import { useUpvoteTask, useRemoveUpvote } from '../hooks/useTasks'

interface Props {
  task: Task
  orgId: string
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  onOpen: (task: Task) => void
}

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

/** Truncate markdown source to ~120 chars then render it */
function DescriptionPreview({ text }: { text: string }) {
  const truncated = text.length > 120 ? text.slice(0, 120) + '…' : text
  return (
    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2 leading-snug">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Strip block elements down to inline-looking spans for card preview
          p: ({ children }) => <span>{children} </span>,
          h1: ({ children }) => <span style={{ fontWeight: 700 }}>{children} </span>,
          h2: ({ children }) => <span style={{ fontWeight: 700 }}>{children} </span>,
          h3: ({ children }) => <span style={{ fontWeight: 700 }}>{children} </span>,
          strong: ({ children }) => <strong>{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          code: ({ children }) => <code style={{ fontFamily: 'monospace' }}>{children}</code>,
          pre: ({ children }) => <span>{children}</span>,
          ul: ({ children }) => <span>{children}</span>,
          ol: ({ children }) => <span>{children}</span>,
          li: ({ children }) => <span>• {children} </span>,
          blockquote: ({ children }) => <span>{children}</span>,
          a: ({ children }) => <span>{children}</span>,
          hr: () => <span> — </span>,
          table: ({ children }) => <span>{children}</span>,
          thead: ({ children }) => <span>{children}</span>,
          tbody: ({ children }) => <span>{children}</span>,
          tr: ({ children }) => <span>{children} </span>,
          th: ({ children }) => <span>{children} </span>,
          td: ({ children }) => <span>{children} </span>,
          input: () => null,
        }}
      >
        {truncated}
      </ReactMarkdown>
    </div>
  )
}

export function TaskCard({ task, orgId, onEdit, onDelete, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const upvote = useUpvoteTask(orgId)
  const removeUpvote = useRemoveUpvote(orgId)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  function handleUpvoteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (task.user_has_upvoted) {
      removeUpvote.mutate(task.id)
    } else {
      upvote.mutate(task.id)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 select-none"
    >
      <div className="flex items-start gap-2">
        {/* Color accent bar */}
        <div
          className="w-1 self-stretch rounded-full flex-shrink-0 min-h-4"
          style={{ backgroundColor: task.color }}
        />
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => onOpen(task)}
            className="block w-full text-left text-sm text-gray-900 dark:text-white leading-snug break-words hover:underline focus:outline-none"
          >
            {task.title}
          </button>
          {task.description && (
            <DescriptionPreview text={task.description} />
          )}
          <div className="flex items-center justify-between mt-2">
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[task.status]}`}
            >
              {STATUS_LABELS[task.status]}
            </span>
            <div className="flex items-center gap-1.5">
              {/* Collaborator avatars */}
              {task.collaborators.length > 0 && (
                <div className="flex -space-x-1.5">
                  {task.collaborators.slice(0, 3).map((c) => (
                    <div
                      key={c.id}
                      className="w-4 h-4 rounded-full ring-1 ring-white dark:ring-gray-900 bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden"
                      title={c.name}
                    >
                      {c.picture ? (
                        <img src={c.picture} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] font-medium text-gray-600 dark:text-gray-300 uppercase">
                          {c.name.charAt(0)}
                        </span>
                      )}
                    </div>
                  ))}
                  {task.collaborators.length > 3 && (
                    <div className="w-4 h-4 rounded-full ring-1 ring-white dark:ring-gray-900 bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      <span className="text-[8px] text-gray-600 dark:text-gray-300">
                        +{task.collaborators.length - 3}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Upvote button */}
              <button
                onClick={handleUpvoteClick}
                disabled={upvote.isPending || removeUpvote.isPending}
                className={`flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded transition-colors disabled:opacity-40 ${
                  task.user_has_upvoted
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'
                }`}
                title={task.user_has_upvoted ? 'Remove upvote' : 'Upvote'}
              >
                <span>{task.user_has_upvoted ? '▲' : '△'}</span>
                {task.upvote_count > 0 && <span>{task.upvote_count}</span>}
              </button>

              {/* Edit / Delete / Drag — shown on hover */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(task)}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors px-1"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(task.id)}
                  className="text-xs text-red-400 dark:text-red-700 hover:text-red-600 dark:hover:text-red-400 transition-colors px-1"
                >
                  Del
                </button>
                <span
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 px-1"
                  title="Drag to reorder"
                >
                  ⠿
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 shadow-xl rotate-2 w-56">
      <p className="text-sm text-gray-900 dark:text-white">{task.title}</p>
    </div>
  )
}
