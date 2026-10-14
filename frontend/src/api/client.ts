export class ApiError extends Error {
  readonly status: number
  /** ProblemDetail `title`, when the response had one. */
  readonly title?: string
  /** ProblemDetail `detail`, when the response had one. The backend never echoes rejected values in it. */
  readonly detail?: string

  constructor(status: number, problem: { title?: string; detail?: string } = {}) {
    super(`Request failed with status ${status}`)
    this.status = status
    this.title = problem.title
    this.detail = problem.detail
  }
}

async function readProblem(response: Response): Promise<{ title?: string; detail?: string }> {
  if (!response.headers.get('content-type')?.includes('json')) return {}
  try {
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null) return {}
    const { title, detail } = body as Record<string, unknown>
    return {
      title: typeof title === 'string' ? title : undefined,
      detail: typeof detail === 'string' ? detail : undefined,
    }
  } catch {
    return {}
  }
}

export async function apiGet<T>(
  path: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw new ApiError(response.status, await readProblem(response))
  }
  return (await response.json()) as T
}
