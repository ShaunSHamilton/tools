import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import type { Task } from '../hooks/useTasks'
import { useUpdateTask, useDeleteTask, useCreateTask } from '../hooks/useTasks'
import { TaskCard, TaskCardOverlay } from './TaskCard'
import { TaskFormModal, type ModalMember } from './TaskFormModal'
import { TaskDetailModal } from './TaskDetailModal'
import { DropReasonModal } from './DropReasonModal'
import { Skeleton } from './Skeleton'

type Status = Task['status']

const COLUMNS: { id: Status; label: string }[] = [
  { id: 'idea', label: 'Idea' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'complete', label: 'Complete' },
  { id: 'dropped', label: 'Dropped' },
]

interface Props {
  orgId: string
  userId: string
  userName: string
  tasks: Task[]
  members?: ModalMember[]
  currentUserId: string
  onBack: () => void
}

function DroppableColumn({
  status,
  label,
  tasks,
  orgId,
  onEdit,
  onDelete,
  onOpen,
}: {
  status: Status
  label: string
  tasks: Task[]
  orgId: string
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onOpen: (t: Task) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col flex-1 min-w-44">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {label}
        </h3>
        <span className="text-xs text-gray-300 dark:text-gray-700">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl min-h-24 transition-colors space-y-2 p-2 ${
          isOver
            ? 'bg-gray-200/60 dark:bg-gray-800/60'
            : 'bg-gray-100/30 dark:bg-gray-900/30'
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} orgId={orgId} onEdit={onEdit} onDelete={onDelete} onOpen={onOpen} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center pt-6 pb-2">
            <p className="text-xs text-gray-300 dark:text-gray-700">Empty</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function UserBoardView({
  orgId,
  userId,
  userName,
  tasks,
  members = [],
  currentUserId,
  onBack,
}: Props) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [pendingDrop, setPendingDrop] = useState<{ taskId: string; status: Status } | null>(null)
  const [isLoading] = useState(false)

  const updateTask = useUpdateTask(orgId)
  const deleteTask = useDeleteTask(orgId)
  const createTask = useCreateTask(orgId)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const byStatus = (status: Status) =>
    tasks
      .filter((t) => t.assignee_id === userId && t.status === status)
      .sort((a, b) => a.position.localeCompare(b.position))

  function handleDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === e.active.id) ?? null)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    const task = tasks.find((t) => t.id === active.id)
    if (!task) return

    const targetStatus = COLUMNS.find((c) => c.id === over.id)?.id
    if (targetStatus && targetStatus !== task.status) {
      if (targetStatus === 'dropped') {
        setPendingDrop({ taskId: task.id, status: 'dropped' })
        return
      }
      updateTask.mutate({ taskId: task.id, status: targetStatus })
    }
  }

  async function handleSaveTask(data: {
    title: string
    description: string | null
    color: string
    collaborator_ids: string[]
  }) {
    if (editingTask === null) {
      await createTask.mutateAsync({
        assignee_id: userId,
        title: data.title,
        description: data.description ?? undefined,
        color: data.color,
        collaborator_ids: data.collaborator_ids,
      })
    } else if (editingTask) {
      await updateTask.mutateAsync({
        taskId: editingTask.id,
        title: data.title,
        description: data.description,
        color: data.color,
        collaborator_ids: data.collaborator_ids,
      })
    }
    setEditingTask(undefined)
  }

  function handleDelete(taskId: string) {
    if (confirm('Delete this task?')) deleteTask.mutate(taskId)
  }

  const userTasks = tasks.filter((t) => t.assignee_id === userId)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          ← Board
        </button>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {userName}'s tasks
        </h2>
        {userId === currentUserId && (
          <button
            onClick={() => setEditingTask(null)}
            className="ml-auto text-sm px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-100"
          >
            + New task
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-4">
          {COLUMNS.map((c) => (
            <div key={c.id} className="flex-1 min-w-44 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : userTasks.length === 0 && userId !== currentUserId ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <p className="text-gray-400 dark:text-gray-500 text-sm">No tasks yet.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
            {COLUMNS.map((col) => (
              <DroppableColumn
                key={col.id}
                status={col.id}
                label={col.label}
                tasks={byStatus(col.id)}
                orgId={orgId}
                onEdit={setEditingTask}
                onDelete={handleDelete}
                onOpen={setViewingTask}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {viewingTask && (
        <TaskDetailModal
          task={viewingTask}
          assigneeName={userName}
          onClose={() => setViewingTask(null)}
          onEdit={(task) => {
            setViewingTask(null)
            setEditingTask(task)
          }}
        />
      )}

      {editingTask !== undefined && (
        <TaskFormModal
          task={editingTask}
          orgId={orgId}
          members={members}
          onSave={handleSaveTask}
          onClose={() => setEditingTask(undefined)}
          isSaving={createTask.isPending || updateTask.isPending}
        />
      )}

      {pendingDrop && (
        <DropReasonModal
          onConfirm={(reason) => {
            updateTask.mutate({ taskId: pendingDrop.taskId, status: 'dropped', drop_reason: reason })
            setPendingDrop(null)
          }}
          onCancel={() => setPendingDrop(null)}
        />
      )}
    </div>
  )
}
