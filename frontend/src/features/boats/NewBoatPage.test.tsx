import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  currentLocation,
  fetchMock,
  json,
  renderBoatRoutes,
  requests,
  serveApi,
  testQueryClient,
} from '../../test/boatRoutes'
import { mockSignedIn } from '../../test/mockAuth'
import type { Boat } from './types'

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn(), hasAuthParams: vi.fn() }))

const saved: Boat = {
  id: 'c1d4647b-067f-4be6-85b9-e844b7845f93',
  name: 'Black Pearl',
  description: null,
  createdAt: '2026-10-14T12:00:00Z',
}
const emptyPage = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }

const nameField = () => screen.getByRole('textbox', { name: 'Name' })
const descriptionField = () => screen.getByRole('textbox', { name: 'Description' })

describe('NewBoatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    mockSignedIn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates the boat and shows it with a confirmation', async () => {
    let posted: unknown
    serveApi(({ method, body }) => {
      if (method === 'POST') {
        posted = body
        return json(saved, 201)
      }
      return json(emptyPage)
    })
    const { user } = renderBoatRoutes('/boats/new')

    expect(screen.getByRole('heading', { level: 1, name: 'Add boat' })).toBeInTheDocument()
    await user.type(nameField(), '  Black Pearl ')
    await user.click(screen.getByRole('button', { name: 'Add boat' }))

    const notice = await screen.findByText('Boat added.')
    expect(notice).toHaveAttribute('role', 'status')
    expect(notice).toHaveFocus()
    expect(screen.getByRole('heading', { level: 1, name: 'Black Pearl' })).toBeInTheDocument()
    expect(currentLocation()).toBe(`/boats/${saved.id}`)
    expect(posted).toEqual({ name: 'Black Pearl', description: null })

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-access-token')
    // The detail page uses the server response stored by the mutation instead of fetching again.
    expect(requests()).toEqual(['POST /api/boats'])
  })

  it('marks the cached fleet pages stale after creating', async () => {
    serveApi(({ method }) => (method === 'POST' ? json(saved, 201) : json(emptyPage)))
    const queryClient = testQueryClient()
    const listKey = ['boats', 'user-1', 'list', { page: 0, search: '' }]
    queryClient.setQueryData(listKey, emptyPage)
    const { user } = renderBoatRoutes('/boats/new', queryClient)

    await user.type(nameField(), 'Black Pearl')
    await user.click(screen.getByRole('button', { name: 'Add boat' }))
    await screen.findByText('Boat added.')
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
  })

  it('disables the form while saving and submits only once', async () => {
    let release: (response: Response) => void = () => undefined
    serveApi(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve
        }),
    )
    const { user } = renderBoatRoutes('/boats/new')
    await user.type(nameField(), 'Black Pearl')
    await user.dblClick(screen.getByRole('button', { name: 'Add boat' }))

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(nameField()).toBeDisabled()
    expect(requests()).toEqual(['POST /api/boats'])
    release(json(saved, 201))
    expect(await screen.findByText('Boat added.')).toBeInTheDocument()
  })

  it('shows server validation errors next to the field and keeps the input', async () => {
    serveApi(() =>
      json(
        {
          title: 'Validation failed',
          status: 400,
          errors: [{ field: 'name', message: 'must not be blank' }],
        },
        400,
        'application/problem+json',
      ),
    )
    const { user } = renderBoatRoutes('/boats/new')
    await user.type(nameField(), 'Black Pearl')
    await user.type(descriptionField(), 'Fast')
    await user.click(screen.getByRole('button', { name: 'Add boat' }))

    await waitFor(() => {
      expect(nameField()).toHaveAttribute('aria-invalid', 'true')
    })
    expect(screen.getByText('Must not be blank.')).toBeInTheDocument()
    expect(nameField()).toHaveFocus()
    expect(nameField()).toHaveValue('Black Pearl')
    expect(descriptionField()).toHaveValue('Fast')
  })

  it('keeps the input after a network error and saves on the next attempt', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json(saved, 201))
    const { user } = renderBoatRoutes('/boats/new')
    await user.type(nameField(), 'Black Pearl')
    await user.click(screen.getByRole('button', { name: 'Add boat' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save the boat. Please try again.',
    )
    expect(nameField()).toBeEnabled()
    expect(nameField()).toHaveValue('Black Pearl')

    await user.click(screen.getByRole('button', { name: 'Add boat' }))
    expect(await screen.findByText('Boat added.')).toBeInTheDocument()
  })

  it('is opened from the fleet and cancels back to the same search and page', async () => {
    serveApi(() => json({ ...emptyPage, content: [saved], totalElements: 25, totalPages: 3 }))
    const { user } = renderBoatRoutes('/boats?search=pearl&page=1')

    await user.click(await screen.findByRole('link', { name: 'Add boat' }))
    expect(currentLocation()).toBe('/boats/new')
    await user.click(screen.getByRole('link', { name: 'Cancel' }))
    expect(currentLocation()).toBe('/boats?search=pearl&page=1')
  })

  it('cancels to the fleet when opened directly', () => {
    renderBoatRoutes('/boats/new')
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/boats')
  })
})
