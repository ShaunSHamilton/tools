import { usePresenceStore } from '../store/presence'

export function ConnectionStatus() {
  const status = usePresenceStore((s) => s.wsStatus)

  if (status === 'connected') return null

  const label =
    status === 'connecting' ? 'Connecting…' :
    status === 'reconnecting' ? 'Reconnecting…' :
    'Disconnected'

  return (
    <span className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-500">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}
