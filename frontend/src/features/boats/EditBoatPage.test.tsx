import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../test/axe'
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

const pearl: Boat = {
  id: 'c1d4647b-067f-4be6-85b9-e844b7845f93',
  name: 'Black Pearl',
  description: 'Fast three-master',
  createdAt: '2026-10-13T13:43:07Z',
}
const editUrl = `/boats/${pearl.id}/edit`
const fleetPage = { content: [pearl], page: 1, size: 10, totalElements: 25, totalPages: 3 }

const nameField = () => screen.getByRole('textbox', { name: 'Name' })
const descriptionField = () => screen.getByRole('textbox', { name: 'Description' })

describe('EditBoatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    mockSignedIn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefills the form, saves with PUT and shows the saved boat', async () => {
    let put: unknown
    serveApi(({ method, body }) => {
      if (method === 'PUT') {
        put = body
        return json({ ...pearl, name: 'Pearl II', description: '  ' })
      }
      return json(pearl)
    })
    const { user } = renderBoatRoutes(editUrl)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit Black Pearl' }),
    ).toBeInTheDocument()
    expect(nameField()).toHaveValue('Black Pearl')
    expect(descriptionField()).toHaveValue('Fast three-master')

    await user.clear(nameField())
    await user.type(nameField(), 'Pearl II')
    await user.clear(descriptionField())
    await user.type(descriptionField(), '  ')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Changes saved.')).toHaveFocus()
    expect(screen.getByRole('heading', { level: 1, name: 'Pearl II' })).toBeInTheDocument()
    expect(currentLocation()).toBe(`/boats/${pearl.id}`)
    expect(put).toEqual({ name: 'Pearl II', description: '  ' })
    expect(requests()).toEqual([`GET /api/boats/${pearl.id}`, `PUT /api/boats/${pearl.id}`])
  })

  it('updates the user-scoped detail cache and marks fleet pages stale', async () => {
    serveApi(({ method }) => json(method === 'PUT' ? { ...pearl, name: 'Pearl II' } : pearl))
    const queryClient = testQueryClient()
    const listKey = ['boats', 'user-1', 'list', { page: 0, search: '' }]
    queryClient.setQueryData(listKey, fleetPage)
    const { user } = renderBoatRoutes(editUrl, queryClient)

    await user.clear(await screen.findByRole('textbox', { name: 'Name' }))
    await user.type(nameField(), 'Pearl II')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Changes saved.')

    expect(queryClient.getQueryData(['boats', 'user-1', 'detail', pearl.id])).toMatchObject({
      name: 'Pearl II',
    })
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
  })

  it('explains when the boat was deleted while editing', async () => {
    serveApi(({ method }) =>
      method === 'PUT' ? json({ title: 'Boat not found', status: 404 }, 404) : json(pearl),
    )
    const { user } = renderBoatRoutes(editUrl)
    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This boat no longer exists.')
  })

  it('shows "Boat not found" with a way back for an unknown or malformed id', async () => {
    serveApi(() => json({ title: 'Boat not found', status: 404 }, 404))
    const unknown = renderBoatRoutes(editUrl)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Boat not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to fleet' })).toHaveAttribute('href', '/boats')
    unknown.unmount()

    fetchMock.mockClear()
    renderBoatRoutes('/boats/not-a-uuid/edit')
    expect(screen.getByRole('heading', { level: 1, name: 'Boat not found' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is opened from the detail page and cancels back to it, keeping the fleet context', async () => {
    serveApi(({ path }) => json(path.startsWith('/api/boats?') ? fleetPage : pearl))
    const { user } = renderBoatRoutes('/boats?search=pearl&page=1')

    await user.click(await screen.findByRole('link', { name: 'Black Pearl' }))
    await user.click(await screen.findByRole('link', { name: 'Edit boat' }))
    expect(currentLocation()).toBe(editUrl)

    await user.click(await screen.findByRole('link', { name: 'Cancel' }))
    expect(currentLocation()).toBe(`/boats/${pearl.id}`)
    await user.click(screen.getByRole('link', { name: 'Back to fleet' }))
    expect(currentLocation()).toBe('/boats?search=pearl&page=1')
  })

  it('has no automatically detectable accessibility violations', async () => {
    serveApi(() => json(pearl))
    const { container } = renderBoatRoutes(editUrl)
    await screen.findByRole('heading', { level: 1, name: 'Edit Black Pearl' })
    expect(await axeViolations(container)).toEqual([])
  })
})
