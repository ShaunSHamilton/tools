import { create } from 'zustand'

export interface RemoteCursor {
  user_id: string
  x: number
  y: number
  board_id: string
}

type WsStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

interface PresenceStore {
  cursors: Record<string, RemoteCursor>
  wsStatus: WsStatus
  updateCursor: (cursor: RemoteCursor) => void
  removeCursor: (userId: string) => void
  clearCursors: () => void
  setWsStatus: (status: WsStatus) => void
}

export const usePresenceStore = create<PresenceStore>((set) => ({
  cursors: {},
  wsStatus: 'disconnected',

  updateCursor: (cursor) =>
    set((state) => ({
      cursors: { ...state.cursors, [cursor.user_id]: cursor },
    })),

  removeCursor: (userId) =>
    set((state) => {
      const { [userId]: _, ...rest } = state.cursors
      return { cursors: rest }
    }),

  clearCursors: () => set({ cursors: {} }),

  setWsStatus: (wsStatus) => set({ wsStatus }),
}))
