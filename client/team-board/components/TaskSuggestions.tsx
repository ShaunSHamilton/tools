import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, Trash2, X, ThumbsUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  useSuggestions,
  useCreateSuggestion,
  useDeleteSuggestion,
  useDismissSuggestion,
  useVoteSuggestion,
  useRemoveVoteSuggestion,
  useReorderSuggestion,
  type Suggestion,
} from '../hooks/useSuggestions'

interface Props {
  taskId: string
  taskOwnerId: string
  currentUserId: string
}

const MAX_CHARS = 50

function SuggestionRow({
  suggestion,
  isTaskOwner,
  currentUserId,
  taskId,
}: {
  suggestion: Suggestion
  isTaskOwner: boolean
  currentUserId: string
  taskId: string
}) {
  const deleteSuggestion = useDeleteSuggestion(taskId)
  const dismissSuggestion = useDismissSuggestion(taskId)
  const vote = useVoteSuggestion(taskId)
  const removeVote = useRemoveVoteSuggestion(taskId)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: suggestion.id,
    disabled: !isTaskOwner,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isAuthor = suggestion.created_by === currentUserId
  const canDelete = isAuthor || isTaskOwner

  function handleVoteClick() {
    if (suggestion.user_has_voted) {
      removeVote.mutate(suggestion.id)
    } else {
      vote.mutate(suggestion.id)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 p-2 rounded-lg border ${
        suggestion.dismissed
          ? 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
      }`}
    >
      {isTaskOwner && (
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 mt-0.5 flex-shrink-0"
          title="Drag to reorder"
        >
          ⠿
        </span>
      )}

      <div className="flex-1 min-w-0">
        <div
          className={`text-sm leading-snug ${
            suggestion.dismissed
              ? 'line-through text-gray-400 dark:text-gray-600'
              : 'text-gray-800 dark:text-gray-200'
          }`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <span>{children}</span>,
              strong: ({ children }) => <strong>{children}</strong>,
              em: ({ children }) => <em>{children}</em>,
              code: ({ children }) => (
                <code style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{children}</code>
              ),
              a: ({ children }) => <span>{children}</span>,
            }}
          >
            {suggestion.content}
          </ReactMarkdown>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] text-gray-400 dark:text-gray-600">
            {suggestion.author.display_name?.trim() || suggestion.author.name}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Vote button */}
        <button
          onClick={handleVoteClick}
          disabled={vote.isPending || removeVote.isPending}
          className={`flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded transition-colors disabled:opacity-40 ${
            suggestion.user_has_voted
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'
          }`}
          title={suggestion.user_has_voted ? 'Remove vote' : '+1'}
        >
          <ThumbsUp size={10} />
          {suggestion.vote_count > 0 && <span>{suggestion.vote_count}</span>}
        </button>

        {/* Dismiss toggle — task owner only */}
        {isTaskOwner && (
          <button
            onClick={() => dismissSuggestion.mutate(suggestion.id)}
            disabled={dismissSuggestion.isPending}
            className={`p-0.5 rounded transition-colors disabled:opacity-40 ${
              suggestion.dismissed
                ? 'text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-400'
                : 'text-gray-400 dark:text-gray-600 hover:text-orange-500 dark:hover:text-orange-400'
            }`}
            title={suggestion.dismissed ? 'Undismiss' : 'Dismiss'}
          >
            <X size={11} />
          </button>
        )}

        {/* Delete — author or task owner */}
        {canDelete && (
          <button
            onClick={() => deleteSuggestion.mutate(suggestion.id)}
            disabled={deleteSuggestion.isPending}
            className="p-0.5 text-gray-300 dark:text-gray-700 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40"
            title="Remove suggestion"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

export function TaskSuggestions({ taskId, taskOwnerId, currentUserId }: Props) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')

  const { data: suggestions = [], isLoading } = useSuggestions(open ? taskId : null)
  const createSuggestion = useCreateSuggestion(taskId)
  const reorderSuggestion = useReorderSuggestion(taskId)

  const isTaskOwner = currentUserId === taskOwnerId

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const activeIdx = suggestions.findIndex((s) => s.id === active.id)
    const overIdx = suggestions.findIndex((s) => s.id === over.id)
    if (activeIdx === -1 || overIdx === -1) return

    const before = suggestions[overIdx - 1] ?? null
    const after = suggestions[overIdx] ?? null

    reorderSuggestion.mutate({
      suggestionId: active.id as string,
      before_id: before?.id !== active.id ? before?.id : undefined,
      after_id: after?.id !== active.id ? after?.id : undefined,
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    await createSuggestion.mutateAsync({ content: trimmed })
    setContent('')
  }

  const charsLeft = MAX_CHARS - content.length

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Suggestions
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 italic">Loading…</p>
          ) : suggestions.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 italic">No suggestions yet</p>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={suggestions.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {suggestions.map((suggestion) => (
                  <SuggestionRow
                    key={suggestion.id}
                    suggestion={suggestion}
                    isTaskOwner={isTaskOwner}
                    currentUserId={currentUserId}
                    taskId={taskId}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {/* New suggestion form */}
          <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
            <div className="flex-1 relative">
              <input
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Add a suggestion… (inline markdown supported)"
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 pr-10"
              />
              <span
                className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums ${
                  charsLeft <= 10
                    ? 'text-red-400 dark:text-red-500'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              >
                {charsLeft}
              </span>
            </div>
            <button
              type="submit"
              disabled={!content.trim() || createSuggestion.isPending}
              className="text-xs px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
