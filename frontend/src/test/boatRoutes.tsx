import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { vi } from 'vitest'
import { Layout } from '../components/Layout'
import { BoatDetailPage } from '../features/boats/BoatDetailPage'
import { BoatsPage } from '../features/boats/BoatsPage'
import { EditBoatPage } from '../features/boats/EditBoatPage'
import { NewBoatPage } from '../features/boats/NewBoatPage'
import { createQueryClient } from '../queryClient'
import { LocationProbe } from './LocationProbe'

export const fetchMock = vi.fn<typeof fetch>()

export function json(body: unknown, status = 200, contentType = 'application/json') {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } })
}

type Handler = (request: {
  method: string
  path: string
  body: unknown
}) => Response | Promise<Response>

/** Answers every fetch with `handler({ method, path, body })`; `path` includes the query string. */
export function serveApi(handler: Handler) {
  fetchMock.mockImplementation((input, init) => {
    const url = new URL(input as string, 'http://localhost')
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    return Promise.resolve(
      handler({ method: init?.method ?? 'GET', path: url.pathname + url.search, body }),
    )
  })
}

/** The requests made so far, as "METHOD path". */
export function requests() {
  return fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? 'GET'} ${input as string}`)
}

export const currentLocation = () => screen.getByTestId('location').textContent

/** The app's query client (same staleTime), without retries so error states appear immediately. */
export function testQueryClient() {
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } })
  return client
}

/** Renders the boat routes inside the real Layout, like App.tsx does for a signed-in user. */
export function renderBoatRoutes(url: string, queryClient: QueryClient = testQueryClient()) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/boats" element={<BoatsPage />} />
            <Route path="/boats/new" element={<NewBoatPage />} />
            <Route path="/boats/:id" element={<BoatDetailPage />} />
            <Route path="/boats/:id/edit" element={<EditBoatPage />} />
          </Route>
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient, user: userEvent.setup() }
}
