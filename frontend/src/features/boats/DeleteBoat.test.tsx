import { screen, within } from '@testing-library/react'
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
import { mockSignedIn, signinRedirect } from '../../test/mockAuth'
import type { Boat, BoatPage } from './types'

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn(), hasAuthParams: vi.fn() }))

const pearl: Boat = {
  id: 'c1d4647b-067f-4be6-85b9-e844b7845f93',
  name: 'Black Pearl',
  description: 'Fast three-master',
  createdAt: '2026-10-13T13:43:07Z',
}
const detailUrl = `/boats/${pearl.id}`
const deleteRequest = `DELETE /api/boats/${pearl.id}`
const fleet = (content: Boat[]): BoatPage => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
})

/** Detail and list return `pearl` until it is deleted; DELETE answers with `deleteResponse()`. */
function serveBoat(
  deleteResponse: () => Response | Promise<Response> = () => new Response(null, { status: 204 }),
) {
  let deleted = false
  serveApi(async ({ method, path }) => {
    if (method === 'DELETE') {
      const response = await deleteResponse()
      deleted = response.status === 204
      return response
    }
    if (path.startsWith('/api/boats?')) return json(fleet(deleted ? [] : [pearl]))
    return deleted ? json({ title: 'Boat not found', status: 404 }, 404) : json(pearl)
  })
}

const deleteButton = () => screen.getByRole('button', { name: 'Delete boat' })
const confirmation = () => screen.getByRole('group', { name: 'Delete “Black Pearl”?' })
const confirmButton = () => screen.getByRole('button', { name: 'Delete permanently' })

describe('DeleteBoat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    mockSignedIn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for confirmation naming the boat, and Cancel sends nothing', async () => {
    serveBoat()
    const { user } = renderBoatRoutes(detailUrl)
    await user.click(await screen.findByRole('button', { name: 'Delete boat' }))

    expect(confirmation()).toHaveFocus()
    expect(confirmation()).toHaveAccessibleDescription(
      'This permanently removes the boat. It cannot be undone.',
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(deleteButton()).toHaveFocus()
    expect(requests()).not.toContain(deleteRequest)
  })

  it('works with the keyboard: Enter opens, Escape cancels, Enter confirms', async () => {
    serveBoat()
    const { user } = renderBoatRoutes(detailUrl)
    ;(await screen.findByRole('button', { name: 'Delete boat' })).focus()

    await user.keyboard('{Enter}')
    expect(confirmation()).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(deleteButton()).toHaveFocus()
    expect(requests()).not.toContain(deleteRequest)

    await user.keyboard('{Enter}')
    await user.tab()
    expect(confirmButton()).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('“Black Pearl” was deleted.')).toBeInTheDocument()
  })

  it('deletes with an authenticated request and returns to the same fleet search', async () => {
    serveBoat()
    const { user } = renderBoatRoutes('/boats?search=pearl')
    await user.click(await screen.findByRole('link', { name: 'Black Pearl' }))
    await user.click(await screen.findByRole('button', { name: 'Delete boat' }))
    await user.click(confirmButton())

    const notice = await screen.findByText('“Black Pearl” was deleted.')
    expect(notice).toHaveAttribute('role', 'status')
    expect(notice).toHaveFocus()
    expect(currentLocation()).toBe('/boats?search=pearl')
    expect(await screen.findByText('No boats match “pearl”.')).toBeInTheDocument()

    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')
    expect(new Headers(call?.[1]?.headers).get('Authorization')).toBe('Bearer test-access-token')
    // The deleted boat is not fetched again (no "Boat not found" flash before leaving the page).
    expect(requests().filter((request) => request === `GET /api/boats/${pearl.id}`)).toHaveLength(1)
  })

  it("removes the boat from this user's cache only and marks this user's lists stale", async () => {
    serveBoat()
    const queryClient = testQueryClient()
    const ownList = ['boats', 'user-1', 'list', { page: 0, search: '' }]
    const otherDetail = ['boats', 'user-2', 'detail', pearl.id]
    const otherList = ['boats', 'user-2', 'list', { page: 0, search: '' }]
    queryClient.setQueryData(ownList, fleet([pearl]))
    queryClient.setQueryData(otherDetail, pearl)
    queryClient.setQueryData(otherList, fleet([pearl]))
    const { user } = renderBoatRoutes(detailUrl, queryClient)

    await user.click(await screen.findByRole('button', { name: 'Delete boat' }))
    await user.click(confirmButton())
    await screen.findByText('“Black Pearl” was deleted.')

    expect(queryClient.getQueryData(['boats', 'user-1', 'detail', pearl.id])).toBeUndefined()
    // The fleet shown after deleting refetches this user's (invalidated) list: the boat is gone.
    expect(await screen.findByText(/The fleet is empty/)).toBeInTheDocument()
    expect(queryClient.getQueryData(ownList)).toEqual(fleet([]))
    expect(requests().slice(requests().indexOf(deleteRequest))).toContain(
      'GET /api/boats?page=0&size=10',
    )
    expect(queryClient.getQueryData(otherDetail)).toEqual(pearl)
    expect(queryClient.getQueryState(otherList)?.isInvalidated).toBe(false)
  })

  it('shows a pending state and sends only one request', async () => {
    let release: (response: Response) => void = () => undefined
    serveBoat(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve
        }),
    )
    const { user } = renderBoatRoutes(detailUrl)
    await user.click(await screen.findByRole('button', { name: 'Delete boat' }))
    await user.dblClick(confirmButton())

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(within(confirmation()).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(requests().filter((request) => request === deleteRequest)).toHaveLength(1)
    release(new Response(null, { status: 204 }))
    expect(await screen.findByText('“Black Pearl” was deleted.')).toBeInTheDocument()
  })

  it('asks the user to sign in again after a 401, without redirecting', async () => {
    serveBoat(() => new Response(null, { status: 401 }))
    const { user } = renderBoatRoutes(detailUrl)
    await user.click(await screen.findByRole('button', { name: 'Delete boat' }))
    await user.click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired.')
    expect(signinRedirect).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(signinRedirect).toHaveBeenCalledOnce()
    expect(currentLocation()).toBe(detailUrl)
  })

  it('explains a 404 (already deleted) and links to the fleet', async () => {
    serveBoat(() => json({ title: 'Boat not found', status: 404 }, 404))
    const queryClient = testQueryClient()
    const ownList = ['boats', 'user-1', 'list', { page: 0, search: '' }]
    queryClient.setQueryData(ownList, fleet([pearl]))
    const { user } = renderBoatRoutes(detailUrl, queryClient)
    await user.click(await screen.findByRole('button', { name: 'Delete boat' }))
    await user.click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('This boat was already deleted.')
    expect(screen.getByRole('link', { name: 'Go to the fleet' })).toHaveAttribute('href', '/boats')
    expect(queryClient.getQueryState(ownList)?.isInvalidated).toBe(true)
  })

  it('keeps the confirmation open after a server or network error so the user can retry', async () => {
    let attempt = 0
    serveBoat(() => {
      attempt += 1
      if (attempt === 1) return new Response('<html>oops</html>', { status: 503 })
      if (attempt === 2) throw new TypeError('Failed to fetch')
      return new Response(null, { status: 204 })
    })
    const { user } = renderBoatRoutes(detailUrl)
    await user.click(await screen.findByRole('button', { name: 'Delete boat' }))

    await user.click(confirmButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete the boat. Please try again.',
    )
    expect(confirmButton()).toBeEnabled()
    await user.click(confirmButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the boat.')
    expect(screen.queryByText(/Failed to fetch|oops/)).not.toBeInTheDocument()

    await user.click(confirmButton())
    expect(await screen.findByText('“Black Pearl” was deleted.')).toBeInTheDocument()
  })

  it('has no automatically detectable accessibility violations with the confirmation open', async () => {
    serveBoat()
    const { container, user } = renderBoatRoutes(detailUrl)
    await user.click(await screen.findByRole('button', { name: 'Delete boat' }))
    expect(await axeViolations(container)).toEqual([])
  })
})
