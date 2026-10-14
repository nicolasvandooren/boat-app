import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { mockAuth, mockSignedIn, signinRedirect, signoutRedirect } from './test/mockAuth'

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn(), hasAuthParams: vi.fn() }))

const privateKey = ['boats', 'list']

function renderApp(path: string, queryClient = new QueryClient()) {
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const view = render(tree())
  return {
    ...view,
    rerenderApp: () => {
      view.rerender(tree())
    },
  }
}

const emptyFleet = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }

describe('App routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json(emptyFleet))),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends an authenticated visitor from / to the fleet overview', () => {
    mockSignedIn()
    renderApp('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Fleet overview' })).toBeInTheDocument()
    expect(screen.getByText('demo')).toBeInTheDocument()
  })

  it('starts the login for an anonymous visitor on a protected route', () => {
    mockAuth()
    renderApp('/boats')
    expect(signinRedirect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('heading', { name: 'Fleet overview' })).not.toBeInTheDocument()
  })

  it('shows the public signed-out page without signing in automatically', async () => {
    mockAuth()
    renderApp('/signed-out')
    expect(
      screen.getByRole('heading', { level: 1, name: 'You have been signed out' }),
    ).toBeInTheDocument()
    expect(signinRedirect).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(signinRedirect).toHaveBeenCalledOnce()
  })

  it('clears cached private data before logging out', async () => {
    mockSignedIn()
    const queryClient = new QueryClient()
    queryClient.setQueryData(privateKey, ['private boat'])
    let cacheAtSignout: unknown = 'not called'
    signoutRedirect.mockImplementationOnce(() => {
      cacheAtSignout = queryClient.getQueryData(privateKey)
      return Promise.resolve()
    })
    renderApp('/boats', queryClient)

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(signoutRedirect).toHaveBeenCalledOnce()
    expect(cacheAtSignout).toBeUndefined()
  })

  it('clears cached private data when the signed-in identity changes', () => {
    mockSignedIn()
    const queryClient = new QueryClient()
    const { rerenderApp } = renderApp('/boats', queryClient)
    queryClient.setQueryData(privateKey, ['private boat'])

    mockSignedIn({ profile: { sub: 'user-2', preferred_username: 'other' } })
    rerenderApp()
    expect(queryClient.getQueryData(privateKey)).toBeUndefined()
  })

  it('keeps the cache while the identity is unchanged', () => {
    mockSignedIn()
    const queryClient = new QueryClient()
    const { rerenderApp } = renderApp('/boats', queryClient)
    queryClient.setQueryData(privateKey, ['private boat'])

    rerenderApp()
    expect(queryClient.getQueryData(privateKey)).toEqual(['private boat'])
  })
})
