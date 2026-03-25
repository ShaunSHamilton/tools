/** Animated placeholder bar. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-800 ${className}`}
    />
  )
}

/** Full board skeleton — several columns with placeholder cards. */
export function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {[0, 1, 2].map((col) => (
        <div key={col} className="flex-shrink-0 w-56 space-y-3">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            {Array.from({ length: 3 - col }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2"
              >
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-4 w-16 mt-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
