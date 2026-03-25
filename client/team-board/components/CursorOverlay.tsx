import { usePresenceStore } from '../store/presence'

const CURSOR_COLORS = [
  '#f97316', '#22c55e', '#06b6d4', '#8b5cf6',
  '#ec4899', '#eab308', '#ef4444', '#14b8a6',
]

function colorForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length]
}

interface Props {
  /** The board the cursor overlay covers — only show cursors on this board. */
  boardId: string
  /** Member names keyed by user_id for labels. */
  memberNames: Record<string, string>
  /** The current user's id — their cursor is never shown. */
  currentUserId: string
}

export function CursorOverlay({ boardId, memberNames, currentUserId }: Props) {
  const cursors = usePresenceStore((s) => s.cursors)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Object.values(cursors)
        .filter((c) => c.board_id === boardId && c.user_id !== currentUserId)
        .map((c) => {
          const color = colorForUser(c.user_id)
          const name = memberNames[c.user_id] ?? 'Unknown'
          return (
            <div
              key={c.user_id}
              className="absolute flex items-center gap-1 transition-transform duration-75"
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
            >
              {/* Cursor dot */}
              <div
                className="w-3 h-3 rounded-full border-2 border-gray-950 shadow-md flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              {/* Name label */}
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white shadow-md whitespace-nowrap"
                style={{ backgroundColor: color }}
              >
                {name}
              </span>
            </div>
          )
        })}
    </div>
  )
}
