import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGet, apiSend } from './client'

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

function respond(status: number, body?: unknown, contentType = 'application/json') {
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: body === undefined ? {} : { 'Content-Type': contentType },
    }),
  )
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  if (!(error instanceof ApiError)) throw new Error('expected an ApiError')
  return error
}

describe('apiGet', () => {
  afterEach(() => fetchMock.mockReset())

  it('sends the bearer token and abort signal and returns the JSON body', async () => {
    respond(200, { ok: true })
    const controller = new AbortController()

    await expect(apiGet('/api/x', 'token-1', controller.signal)).resolves.toEqual({ ok: true })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/x')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token-1')
    expect(init?.signal).toBe(controller.signal)
  })

  it('keeps the ProblemDetail title and detail of an error', async () => {
    respond(
      400,
      { title: 'Validation failed', detail: 'One or more fields are invalid.', status: 400 },
      'application/problem+json',
    )
    const error = await failure(apiGet('/api/x', 't'))
    expect(error.status).toBe(400)
    expect(error.title).toBe('Validation failed')
    expect(error.detail).toBe('One or more fields are invalid.')
  })

  it('handles an empty 401 body', async () => {
    respond(401)
    const error = await failure(apiGet('/api/x', 't'))
    expect(error.status).toBe(401)
    expect(error.detail).toBeUndefined()
  })

  it('ignores error bodies that are not ProblemDetail JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>Bad gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    )
    const error = await failure(apiGet('/api/x', 't'))
    expect(error.status).toBe(502)
    expect(error.title).toBeUndefined()
  })

  it('sends JSON with the bearer token and returns the saved resource', async () => {
    respond(201, { id: 'b1' })

    await expect(apiSend('POST', '/api/boats', 'token-1', { name: 'Gull' })).resolves.toEqual({
      id: 'b1',
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/boats')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"name":"Gull"}')
    const headers = new Headers(init?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Authorization')).toBe('Bearer token-1')
  })

  it('keeps well-formed field errors and drops malformed ones', async () => {
    respond(
      400,
      {
        title: 'Validation failed',
        status: 400,
        errors: [
          { field: 'name', message: 'must not be blank' },
          { field: 'description' },
          'nonsense',
          { field: 'other', message: 'is wrong' },
        ],
      },
      'application/problem+json',
    )
    const error = await failure(apiSend('PUT', '/api/boats/x', 't', {}))
    expect(error.fieldErrors).toEqual([
      { field: 'name', message: 'must not be blank' },
      { field: 'other', message: 'is wrong' },
    ])
  })
})
