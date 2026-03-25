import { useRef, useCallback } from 'react'

/** Returns a throttled version of `fn` that fires at most once per `ms`. */
export function useThrottle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number,
): T {
  const lastRun = useRef(0)

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastRun.current >= ms) {
        lastRun.current = now
        fn(...args)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, ms],
  ) as T
}
