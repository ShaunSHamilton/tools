import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Opens an SSE connection to /api/notifications/stream and invalidates the
 * notifications query whenever the server signals a new notification. Mount
 * this once at the root so all apps get real-time updates.
 */
export function useNotificationStream() {
  const qc = useQueryClient()

  useEffect(() => {
    const es = new EventSource('/api/notifications/stream', { withCredentials: true })

    es.onmessage = () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    }

    es.onerror = () => {
      // Browser will automatically reconnect; nothing to do here.
    }

    return () => es.close()
  }, [qc])
}
