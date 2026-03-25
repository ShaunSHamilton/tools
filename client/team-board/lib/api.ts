const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? "/team-board";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const prefixedPath = path.startsWith("/") ? `${API_PREFIX}${path}` : path;
  const res = await fetch(prefixedPath, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
