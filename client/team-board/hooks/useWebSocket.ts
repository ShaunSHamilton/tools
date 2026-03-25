import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePresenceStore } from '../store/presence'
import type { Task } from './useTasks'

interface TaskReorderedPayload {
  id: string
  position: string
  assignee_id: string
}

function handleMessage(
  msg: { type: string; payload: unknown },
  orgId: string,
  qc: ReturnType<typeof useQueryClient>,
) {
  const { updateCursor, removeCursor } = usePresenceStore.getState()

  switch (msg.type) {
    case 'task_created':
      qc.setQueryData<Task[]>(['tasks', orgId], (old = []) => {
        // Avoid duplicates (our own mutation already wrote it optimistically if any)
        const t = msg.payload as Task
        return old.some((x) => x.id === t.id) ? old : [...old, t]
      })
      break

    case 'task_updated':
      qc.setQueryData<Task[]>(['tasks', orgId], (old = []) =>
        old.map((t) => (t.id === (msg.payload as Task).id ? (msg.payload as Task) : t)),
      )
      break

    case 'task_deleted':
      qc.setQueryData<Task[]>(['tasks', orgId], (old = []) =>
        old.filter((t) => t.id !== (msg.payload as { id: string }).id),
      )
      break

    case 'task_reordered': {
      const p = msg.payload as TaskReorderedPayload
      qc.setQueryData<Task[]>(['tasks', orgId], (old = []) =>
        old.map((t) =>
          t.id === p.id ? { ...t, position: p.position, assignee_id: p.assignee_id } : t,
        ),
      )
      break
    }

    case 'cursor_moved':
      updateCursor(msg.payload as Parameters<typeof updateCursor>[0])
      break

    case 'user_left':
      removeCursor((msg.payload as { user_id: string }).user_id)
      break

    case 'member_added':
    case 'member_removed':
      qc.invalidateQueries({ queryKey: ['orgs', orgId] })
      break

    case 'notification':
      qc.invalidateQueries({ queryKey: ['notifications'] })
      break
  }
}

/**
 * Opens a WebSocket connection for `orgId`. Reconnects with exponential
 * backoff on unexpected close. Tears down on unmount or orgId change.
 * Returns a send function for outbound messages.
 */
export function useWebSocket(orgId: string) {
  const qc = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelay = useRef(1000)
  const cancelledRef = useRef(false)
  const { setWsStatus, clearCursors } = usePresenceStore()

  // Stable send function – always writes to the current socket
  const sendRef = useRef<(msg: object) => void>(() => {})

  useEffect(() => {
    if (!orgId) return
    cancelledRef.current = false
    reconnectDelay.current = 1000

    function connect() {
      if (cancelledRef.current) return

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const url = `${protocol}//${window.location.host}/team-board/ws`

      setWsStatus('connecting')
      const ws = new WebSocket(url)
      wsRef.current = ws

      sendRef.current = (msg: object) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg))
        }
      }

      ws.onopen = () => {
        reconnectDelay.current = 1000
        setWsStatus('connected')
        ws.send(JSON.stringify({ type: 'join', org_id: orgId }))
      }

      ws.onmessage = (e: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(e.data) as { type: string; payload: unknown }
          handleMessage(msg, orgId, qc)
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        clearCursors()
        if (!cancelledRef.current) {
          setWsStatus('reconnecting')
          const delay = reconnectDelay.current
          reconnectDelay.current = Math.min(delay * 2, 30_000)
          setTimeout(connect, delay)
        } else {
          setWsStatus('disconnected')
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      cancelledRef.current = true
      wsRef.current?.close()
      clearCursors()
      setWsStatus('disconnected')
    }
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  return sendRef
}
