import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../hooks/useTasks'

interface Props {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
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

export function TaskCard({ task, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
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
          <p className="text-sm text-gray-900 dark:text-white leading-snug break-words">
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[task.status]}`}
            >
              {STATUS_LABELS[task.status]}
            </span>
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
  )
}

export function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 shadow-xl rotate-2 w-56">
      <p className="text-sm text-gray-900 dark:text-white">{task.title}</p>
    </div>
  )
}
