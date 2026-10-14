/** One entry of a ProblemDetail `errors` array (backend/README.md, "400: invalid body"). */
export interface FieldError {
  field: string
  message: string
}

interface Problem {
  title?: string
  detail?: string
  fieldErrors?: FieldError[]
}

export class ApiError extends Error {
  readonly status: number
  /** ProblemDetail `title`, when the response had one. */
  readonly title?: string
  /** ProblemDetail `detail`, when the response had one. The backend never echoes rejected values in it. */
  readonly detail?: string
  /** Well-formed entries of the ProblemDetail `errors` array; malformed entries are dropped. */
  readonly fieldErrors?: FieldError[]

  constructor(status: number, problem: Problem = {}) {
    super(`Request failed with status ${status}`)
    this.status = status
    this.title = problem.title
    this.detail = problem.detail
    this.fieldErrors = problem.fieldErrors
  }
}

function isFieldError(value: unknown): value is FieldError {
  if (typeof value !== 'object' || value === null) return false
  const { field, message } = value as Record<string, unknown>
  return typeof field === 'string' && typeof message === 'string'
}

async function readProblem(response: Response): Promise<Problem> {
  if (!response.headers.get('content-type')?.includes('json')) return {}
  try {
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null) return {}
    const { title, detail, errors } = body as Record<string, unknown>
    return {
      title: typeof title === 'string' ? title : undefined,
      detail: typeof detail === 'string' ? detail : undefined,
      fieldErrors: Array.isArray(errors) ? errors.filter(isFieldError) : undefined,
    }
  } catch {
    return {}
  }
}

async function request<T>(path: string, accessToken: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('Accept', 'application/json')
  const response = await fetch(path, { ...init, headers })
  if (!response.ok) {
    throw new ApiError(response.status, await readProblem(response))
  }
  return (await response.json()) as T
}

export function apiGet<T>(path: string, accessToken: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, accessToken, { signal })
}

/** Sends `body` as JSON and returns the JSON response (the API answers writes with the saved resource). */
export function apiSend<T>(
  method: 'POST' | 'PUT',
  path: string,
  accessToken: string,
  body: unknown,
): Promise<T> {
  return request<T>(path, accessToken, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
