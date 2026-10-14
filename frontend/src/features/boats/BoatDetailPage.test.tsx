import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Layout } from '../../components/Layout'
import { axeViolations } from '../../test/axe'
import { mockSignedIn, signinRedirect } from '../../test/mockAuth'
import { BoatDetailPage } from './BoatDetailPage'
import { BoatsPage } from './BoatsPage'
import type { Boat } from './types'

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn(), hasAuthParams: vi.fn() }))

const fetchMock = vi.fn<typeof fetch>()

const pearl: Boat = {
  id: 'c1d4647b-067f-4be6-85b9-e844b7845f93',
  name: 'Black Pearl',
  description: 'Fast three-master',
  createdAt: '2026-10-13T13:43:07Z',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Serves the list (always one page with `pearl`) and the detail endpoint via `detail`. */
function serve(detail: () => Response | Promise<Response>) {
  fetchMock.mockImplementation((input) => {
    const url = new URL(input as string, 'http://localhost')
    if (url.pathname === '/api/boats') {
      const page = Number(url.searchParams.get('page'))
      return Promise.resolve(
        json({ content: [pearl], page, size: 10, totalElements: 25, totalPages: 3 }),
      )
    }
    return Promise.resolve(detail())
  })
}

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{location.pathname + location.search}</span>
}

function renderAt(url: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/boats" element={<BoatsPage />} />
            <Route path="/boats/:id" element={<BoatDetailPage />} />
          </Route>
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient, user: userEvent.setup() }
}

const detailUrl = `/boats/${pearl.id}`

describe('BoatDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    mockSignedIn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the boat with the bearer token and a readable creation date', async () => {
    serve(() => json(pearl))
    renderAt(detailUrl)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Black Pearl' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Fast three-master')).toBeInTheDocument()
    const time = screen.getByText((_content, element) => element?.tagName === 'TIME')
    expect(time).toHaveAttribute('datetime', '2026-10-13T13:43:07Z')
    expect(time.textContent).toMatch(/2026/)
    expect(document.title).toBe('Black Pearl – The Boat App')

    const [input, init] = fetchMock.mock.calls[0] ?? []
    expect(input).toBe(`/api/boats/${pearl.id}`)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-access-token')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('shows a fallback for a missing description', async () => {
    serve(() => json({ ...pearl, description: null }))
    renderAt(detailUrl)
    expect(await screen.findByText('No description')).toBeInTheDocument()
  })

  it('announces loading until the boat arrives', async () => {
    let release: (response: Response) => void = () => undefined
    serve(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve
        }),
    )
    renderAt(detailUrl)

    expect(await screen.findByRole('status')).toHaveTextContent('Loading boat…')
    release(json(pearl))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Black Pearl' }),
    ).toBeInTheDocument()
  })

  it('shows "Boat not found" for a 404, with a way back and no retry', async () => {
    serve(() =>
      json({ title: 'Boat not found', status: 404, detail: `No boat with id ${pearl.id}` }, 404),
    )
    renderAt(detailUrl)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Boat not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to fleet' })).toHaveAttribute('href', '/boats')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    // The backend's technical detail is not shown.
    expect(screen.queryByText(/No boat with id/)).not.toBeInTheDocument()
  })

  it('treats an id that is not a UUID as not found, without calling the API', () => {
    serve(() => json(pearl))
    renderAt('/boats/not-a-uuid')
    expect(screen.getByRole('heading', { level: 1, name: 'Boat not found' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks the user to sign in again after a 401, without redirecting', async () => {
    serve(() => new Response(null, { status: 401 }))
    const { user } = renderAt(detailUrl)

    expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired.')
    expect(signinRedirect).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(signinRedirect).toHaveBeenCalledOnce()
  })

  it('shows a generic error for server and network failures and retries on request', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('<html>oops</html>', { status: 503 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json(pearl))
    const { user } = renderAt(detailUrl)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load this boat. Please try again.',
    )
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this boat.')
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Black Pearl' }),
    ).toBeInTheDocument()
  })

  it('keeps showing the boat when a background refetch fails, and reports it', async () => {
    let status = 200
    serve(() => (status === 200 ? json(pearl) : json({ title: 'Boat not found', status }, status)))
    const { queryClient, user } = renderAt(detailUrl)
    await screen.findByRole('heading', { level: 1, name: 'Black Pearl' })

    // E.g. a refetch on window focus after the boat was deleted elsewhere.
    status = 404
    await act(() => queryClient.refetchQueries({ queryKey: ['boats', 'user-1', 'detail'] }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not refresh this boat; the last loaded version is shown. It may have been deleted.',
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Black Pearl' })).toBeInTheDocument()

    status = 200
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('does not call the API before authentication is confirmed', () => {
    mockSignedIn({ profile: { sub: 'user-1', preferred_username: 'demo' } })
    serve(() => json(pearl))
    renderAt(detailUrl)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caches the boat under the signed-in subject', async () => {
    serve(() => json(pearl))
    const { queryClient } = renderAt(detailUrl)
    await screen.findByRole('heading', { level: 1, name: 'Black Pearl' })
    expect(queryClient.getQueryData(['boats', 'user-1', 'detail', pearl.id])).toEqual(pearl)
  })

  it('opens a boat from the fleet and returns to the same search and page', async () => {
    serve(() => json(pearl))
    const { user } = renderAt('/boats?search=pearl&page=1')

    await user.click(await screen.findByRole('link', { name: 'Black Pearl' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Black Pearl' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(detailUrl)
    // Focus moves to the new page's content after client-side navigation.
    expect(document.activeElement).toBe(screen.getByRole('main'))

    await user.click(screen.getByRole('link', { name: 'Back to fleet' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/boats?search=pearl&page=1')
    expect(screen.getByRole('searchbox', { name: 'Search boats' })).toHaveValue('pearl')
    const pagination = await screen.findByRole('navigation', { name: 'Pagination' })
    expect(within(pagination).getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('falls back to the first fleet page on a direct visit', async () => {
    serve(() => json(pearl))
    renderAt(detailUrl)
    await screen.findByRole('heading', { level: 1, name: 'Black Pearl' })
    expect(screen.getByRole('link', { name: 'Back to fleet' })).toHaveAttribute('href', '/boats')
  })

  it('has no automatically detectable accessibility violations (boat and not found)', async () => {
    serve(() => json(pearl))
    const loaded = renderAt(detailUrl)
    await screen.findByRole('heading', { level: 1, name: 'Black Pearl' })
    expect(await axeViolations(loaded.container)).toEqual([])
    loaded.unmount()

    serve(() => json({ title: 'Boat not found', status: 404 }, 404))
    const missing = renderAt(detailUrl)
    await screen.findByRole('heading', { level: 1, name: 'Boat not found' })
    expect(await axeViolations(missing.container)).toEqual([])
  })
})
