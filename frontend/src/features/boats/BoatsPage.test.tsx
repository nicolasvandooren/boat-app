import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../test/axe'
import { mockSignedIn, signinRedirect } from '../../test/mockAuth'
import { BoatsPage } from './BoatsPage'
import type { Boat, BoatPage } from './types'

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn(), hasAuthParams: vi.fn() }))

const fetchMock = vi.fn<typeof fetch>()

function boat(n: number, overrides: Partial<Boat> = {}): Boat {
  return {
    id: `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
    name: `Boat ${n}`,
    description: `Description ${n}`,
    createdAt: '2026-10-13T13:43:07Z',
    ...overrides,
  }
}

function pageOf(content: Boat[], page = 0, totalElements = content.length): BoatPage {
  return { content, page, size: 10, totalElements, totalPages: Math.ceil(totalElements / 10) }
}

function json(body: unknown, status = 200, contentType = 'application/json') {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } })
}

/** Answers GET /api/boats with `handler(page, search)`. */
function serveBoats(handler: (page: number, search: string) => Response | Promise<Response>) {
  fetchMock.mockImplementation((input) => {
    const url = new URL(input as string, 'http://localhost')
    return Promise.resolve(
      handler(Number(url.searchParams.get('page')), url.searchParams.get('search') ?? ''),
    )
  })
}

function requestedUrls() {
  return fetchMock.mock.calls.map(([input]) => input as string)
}

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <span data-testid="location">{location.search}</span>
      <button type="button" onClick={() => void navigate(-1)}>
        History back
      </button>
      <button type="button" onClick={() => void navigate(1)}>
        History forward
      </button>
    </>
  )
}

function renderPage(
  url = '/boats',
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const { container, unmount } = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/boats" element={<BoatsPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { container, unmount, queryClient, user: userEvent.setup() }
}

const location = () => screen.getByTestId('location')
const searchBox = () => screen.getByRole('searchbox', { name: 'Search boats' })

describe('BoatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    mockSignedIn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the first page with the bearer token and shows each boat', async () => {
    serveBoats(() => json(pageOf([boat(1), boat(2, { description: null })], 0, 12)))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Loading boats…')
    const cards = await screen.findAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByRole('heading', { name: 'Boat 1' })).toBeInTheDocument()
    expect(within(cards[0]).getByText('Description 1')).toBeInTheDocument()
    expect(within(cards[1]).getByText('No description')).toBeInTheDocument()
    expect(cards[0].querySelector('time')).toHaveAttribute('datetime', '2026-10-13T13:43:07Z')
    expect(screen.getByRole('status')).toHaveTextContent('12 boats')
    expect(within(cards[0]).getByRole('link', { name: 'Boat 1' })).toHaveAttribute(
      'href',
      `/boats/${boat(1).id}`,
    )

    expect(requestedUrls()).toEqual(['/api/boats?page=0&size=10'])
    const init = fetchMock.mock.calls[0]?.[1]
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-access-token')
  })

  it('caches the list under the signed-in subject', async () => {
    serveBoats(() => json(pageOf([boat(1)])))
    const { queryClient } = renderPage('/boats?page=0&search=pearl')
    await screen.findByText('Boat 1')
    expect(
      queryClient.getQueryData(['boats', 'user-1', 'list', { page: 0, search: 'pearl' }]),
    ).toBeDefined()
  })

  it('does not fetch without an access token', () => {
    mockSignedIn({ profile: { sub: 'user-1', preferred_username: 'demo' } })
    serveBoats(() => json(pageOf([])))
    renderPage()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows an empty fleet', async () => {
    serveBoats(() => json(pageOf([])))
    renderPage()
    expect(await screen.findByText(/Your fleet is empty/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('0 boats')
  })

  it('shows an empty search result and clears the search', async () => {
    serveBoats((_page, search) => json(search ? pageOf([]) : pageOf([boat(1)])))
    const { user } = renderPage('/boats?search=zzz')
    expect(await screen.findByText('No boats match “zzz”.')).toBeInTheDocument()
    expect(searchBox()).toHaveValue('zzz')

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(location()).toHaveTextContent(/^$/)
    expect(searchBox()).toHaveValue('')
    expect(await screen.findByText('Boat 1')).toBeInTheDocument()
  })

  it('debounces typing into the URL, resets the page, and never resets the input mid-word', async () => {
    serveBoats((page, search) =>
      json(pageOf([boat(page + 1, { name: `Hit ${search || 'all'}` })], page, 30)),
    )
    const { user } = renderPage('/boats?page=2')
    await screen.findByText('Hit all')

    await user.type(searchBox(), 'pe')
    await waitFor(() => {
      expect(location()).toHaveTextContent('?search=pe')
    })
    // Results for "pe" arrive while the user keeps typing; the input must keep every keystroke.
    await user.type(searchBox(), 'arl')
    expect(searchBox()).toHaveValue('pearl')
    await waitFor(() => {
      expect(location()).toHaveTextContent('?search=pearl')
    })
    expect(searchBox()).toHaveValue('pearl')
    expect(location()).not.toHaveTextContent('page=')
    expect(await screen.findByText('Hit pearl')).toBeInTheDocument()
    expect(requestedUrls()).toContain('/api/boats?page=0&size=10&search=pearl')
  })

  it('keeps a trailing space when the debounced search is sent mid-phrase', async () => {
    serveBoats((_page, search) => json(pageOf([boat(1, { name: `Hit ${search || 'all'}` })])))
    const { user } = renderPage()
    await screen.findByText('Hit all')

    await user.type(searchBox(), 'pearl ')
    await waitFor(() => {
      expect(location()).toHaveTextContent('?search=pearl')
    })
    await screen.findByText('Hit pearl')
    expect(searchBox()).toHaveValue('pearl ')

    await user.type(searchBox(), 'harbour')
    expect(searchBox()).toHaveValue('pearl harbour')
    await waitFor(() => {
      expect(location()).toHaveTextContent('?search=pearl+harbour')
    })
  })

  it('applies the search immediately on Enter and trims it', async () => {
    serveBoats(() => json(pageOf([boat(1)])))
    const { user } = renderPage()
    await screen.findByText('Boat 1')

    await user.type(searchBox(), '  harbour {Enter}')
    expect(location()).toHaveTextContent('?search=harbour')
    expect(searchBox()).toHaveValue('  harbour ')
  })

  it('never shows results of a previous search while a new one loads', async () => {
    let releaseSearch: (response: Response) => void = () => undefined
    serveBoats((_page, search) =>
      search
        ? new Promise<Response>((resolve) => {
            releaseSearch = resolve
          })
        : json(pageOf([boat(1)])),
    )
    const { user } = renderPage()
    await screen.findByText('Boat 1')

    await user.type(searchBox(), 'zzz{Enter}')
    await waitFor(() => {
      expect(screen.queryByText('Boat 1')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('status')).toHaveTextContent('Loading boats…')

    releaseSearch(json(pageOf([])))
    expect(await screen.findByText('No boats match “zzz”.')).toBeInTheDocument()
  })

  it('keeps the input and URL in sync on browser back and forward', async () => {
    serveBoats((page, search) =>
      json(pageOf([boat(page + 1, { name: `Hit ${search || 'all'}` })], page, 30)),
    )
    const { user } = renderPage()
    await screen.findByText('Hit all')

    await user.click(screen.getByRole('link', { name: 'Next page' }))
    expect(location()).toHaveTextContent('?page=1')
    await user.type(searchBox(), 'mast{Enter}')
    expect(location()).toHaveTextContent('?search=mast')

    await user.click(screen.getByRole('button', { name: 'History back' }))
    expect(location()).toHaveTextContent(/^$/)
    expect(searchBox()).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'History forward' }))
    expect(location()).toHaveTextContent('?search=mast')
    expect(searchBox()).toHaveValue('mast')
  })

  it('paginates with previous and next links', async () => {
    serveBoats((page) => json(pageOf([boat(page * 10 + 1)], page, 25)))
    const { user } = renderPage()
    await screen.findByText('Boat 1')

    const pagination = screen.getByRole('navigation', { name: 'Pagination' })
    expect(within(pagination).getByText('Page 1 of 3')).toBeInTheDocument()
    expect(
      within(pagination).queryByRole('link', { name: 'Previous page' }),
    ).not.toBeInTheDocument()

    await user.click(within(pagination).getByRole('link', { name: 'Next page' }))
    expect(location()).toHaveTextContent('?page=1')
    expect(await screen.findByText('Boat 11')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(requestedUrls()).toContain('/api/boats?page=1&size=10')

    await user.click(screen.getByRole('link', { name: 'Previous page' }))
    expect(location()).toHaveTextContent(/^$/)
    expect(await screen.findByText('Boat 1')).toBeInTheDocument()
  })

  it('offers a way back from a page past the end', async () => {
    serveBoats((page) => json(pageOf(page === 0 ? [boat(1)] : [], page, 3)))
    const { user } = renderPage('/boats?page=7')
    expect(await screen.findByText('This page does not exist.')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Go to the first page' }))
    expect(await screen.findByText('Boat 1')).toBeInTheDocument()
  })

  it('shows an error and retries on request', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(json(pageOf([boat(1)])))
    const { user } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load boats.')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Boat 1')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the ProblemDetail of a rejected request', async () => {
    serveBoats(() =>
      json(
        { title: 'Validation failed', detail: 'One or more fields are invalid.', status: 400 },
        400,
        'application/problem+json',
      ),
    )
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('One or more fields are invalid.')
  })

  it('asks the user to sign in again after a 401, without redirecting or retrying', async () => {
    serveBoats(() => new Response(null, { status: 401 }))
    const { user } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired.')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(signinRedirect).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(signinRedirect).toHaveBeenCalledOnce()
  })

  it('has no automatically detectable accessibility violations (boats and empty fleet)', async () => {
    serveBoats(() => json(pageOf([boat(1), boat(2, { description: null })], 0, 25)))
    const withBoats = renderPage()
    await screen.findByText('Boat 1')
    expect(await axeViolations(withBoats.container)).toEqual([])
    withBoats.unmount()

    serveBoats(() => json(pageOf([])))
    const empty = renderPage()
    await screen.findByText(/Your fleet is empty/)
    expect(await axeViolations(empty.container)).toEqual([])
  })
})
