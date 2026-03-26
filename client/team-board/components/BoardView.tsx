import { useRef, useState } from 'react'
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
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useReorderTask,
  useDeleteTask,
} from '../hooks/useTasks'
import type { Task } from '../hooks/useTasks'
import { TaskCard, TaskCardOverlay } from './TaskCard'
import { TaskFormModal, type ModalMember } from './TaskFormModal'
import { TaskDetailModal } from './TaskDetailModal'
import { DropReasonModal } from './DropReasonModal'
import { UserBoardView } from './UserBoardView'
import { CursorOverlay } from './CursorOverlay'
import { BoardSkeleton } from './Skeleton'
import { useWebSocket } from '../hooks/useWebSocket'
import { useThrottle } from '../hooks/useThrottle'
import type { OrgMember } from '../hooks/useOrgs'

interface Props {
  orgId: string
  members: OrgMember[]
  currentUserId: string
}

function MemberColumn({
  member,
  tasks,
  orgId,
  onEdit,
  onDelete,
  onOpen,
  onAddTask,
  onClickHeader,
  isCurrentUser,
}: {
  member: OrgMember
  tasks: Task[]
  orgId: string
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onOpen: (t: Task) => void
  onAddTask: () => void
  onClickHeader: () => void
  isCurrentUser: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: member.user.id })

  return (
    <div className="flex flex-col flex-shrink-0 w-56">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onClickHeader}
          className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors text-left truncate"
        >
          {member.user.display_name?.trim() || member.user.name}
          {isCurrentUser && (
            <span className="ml-1 text-xs text-gray-400 dark:text-gray-600">(you)</span>
          )}
        </button>
        {isCurrentUser && (
          <button
            onClick={onAddTask}
            className="text-gray-400 dark:text-gray-600 hover:text-gray-900 dark:hover:text-white text-lg leading-none transition-colors"
            title="Add task"
          >
            +
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-xl min-h-24 p-2 transition-colors ${
          isOver
            ? 'bg-gray-200/60 dark:bg-gray-800/60'
            : 'bg-gray-100/30 dark:bg-gray-900/20'
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} orgId={orgId} onEdit={onEdit} onDelete={onDelete} onOpen={onOpen} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center pt-6 pb-2">
            <p className="text-xs text-gray-300 dark:text-gray-700">No tasks</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function BoardView({ orgId, members, currentUserId }: Props) {
  const { data: tasks = [], isLoading } = useTasks(orgId)
  const createTask = useCreateTask(orgId)
  const updateTask = useUpdateTask(orgId)
  const reorderTask = useReorderTask(orgId)
  const deleteTask = useDeleteTask(orgId)

  const sendWs = useWebSocket(orgId)
  const boardRef = useRef<HTMLDivElement>(null)

  const memberNames: Record<string, string> = Object.fromEntries(
    members.map((m) => [m.user.id, m.user.display_name?.trim() || m.user.name]),
  )

  const emitCursor = useThrottle((x: number, y: number) => {
    sendWs.current({ type: 'cursor_move', x, y, board_id: 'main' })
  }, 100)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return
    emitCursor(
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height,
    )
  }

  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [createForMember, setCreateForMember] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [pendingDrop, setPendingDrop] = useState<{ taskId: string; newAssigneeId: string } | null>(
    null,
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const tasksForMember = (userId: string) =>
    tasks
      .filter((t) => t.assignee_id === userId)
      .sort((a, b) => a.position.localeCompare(b.position))

  function handleDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === e.active.id) ?? null)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    const draggedTask = tasks.find((t) => t.id === active.id)
    if (!draggedTask) return

    const memberTarget = members.find((m) => m.user.id === over.id)
    if (memberTarget && memberTarget.user.id !== draggedTask.assignee_id) {
      updateTask.mutate({ taskId: draggedTask.id, assignee_id: memberTarget.user.id })
      return
    }

    const overTask = tasks.find((t) => t.id === over.id)
    if (overTask && overTask.assignee_id === draggedTask.assignee_id) {
      const columnTasks = tasksForMember(draggedTask.assignee_id)
      const overIdx = columnTasks.findIndex((t) => t.id === overTask.id)
      const before = columnTasks[overIdx - 1] ?? null
      const after = columnTasks[overIdx] ?? null

      reorderTask.mutate({
        taskId: draggedTask.id,
        before_id: before?.id,
        after_id: after?.id !== draggedTask.id ? after?.id : undefined,
      })
    }
  }

  async function handleSaveTask(data: {
    title: string
    description: string | null
    color: string
    collaborator_ids: string[]
  }) {
    if (editingTask === null && createForMember) {
      await createTask.mutateAsync({
        assignee_id: createForMember,
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
    setCreateForMember(null)
  }

  function handleDelete(taskId: string) {
    if (confirm('Delete this task?')) deleteTask.mutate(taskId)
  }

  if (selectedUserId) {
    const member = members.find((m) => m.user.id === selectedUserId)
    if (member) {
      return (
        <UserBoardView
          orgId={orgId}
          userId={selectedUserId}
          userName={member.user.name}
          tasks={tasks}
          members={members.map((m): ModalMember => ({ id: m.user.id, name: m.user.name }))}
          currentUserId={currentUserId}
          onBack={() => setSelectedUserId(null)}
        />
      )
    }
  }

  if (isLoading) return <BoardSkeleton />

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">Board</h2>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          ref={boardRef}
          className="relative flex gap-4 overflow-x-auto pb-4 flex-1"
          onMouseMove={handleMouseMove}
        >
          {members.map((member) => (
            <MemberColumn
              key={member.user.id}
              member={member}
              tasks={tasksForMember(member.user.id)}
              orgId={orgId}
              onEdit={setEditingTask}
              onDelete={handleDelete}
              onOpen={setViewingTask}
              isCurrentUser={member.user.id === currentUserId}
              onAddTask={() => {
                setCreateForMember(member.user.id)
                setEditingTask(null)
              }}
              onClickHeader={() => setSelectedUserId(member.user.id)}
            />
          ))}
          <CursorOverlay boardId="main" memberNames={memberNames} currentUserId={currentUserId} />
        </div>
        <DragOverlay>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {viewingTask && (
        <TaskDetailModal
          task={viewingTask}
          assigneeName={memberNames[viewingTask.assignee_id]}
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
          members={members.map((m): ModalMember => ({ id: m.user.id, name: m.user.name }))}
          onSave={handleSaveTask}
          onClose={() => { setEditingTask(undefined); setCreateForMember(null) }}
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
