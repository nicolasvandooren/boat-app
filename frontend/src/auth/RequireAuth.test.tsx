import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { useAuth } from 'react-oidc-context'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAuth, mockSignedIn, signinRedirect } from '../test/mockAuth'
import { RequireAuth } from './RequireAuth'

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn(), hasAuthParams: vi.fn() }))

const guardedTree = () => (
  <StrictMode>
    <MemoryRouter initialEntries={['/boats']}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/boats" element={<p>Private fleet</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  </StrictMode>
)

function renderGuarded() {
  return render(guardedTree())
}

describe('RequireAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects an anonymous visitor to Keycloak exactly once, even under StrictMode', () => {
    mockAuth()
    const { rerender } = renderGuarded()
    rerender(guardedTree())
    expect(signinRedirect).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in')
    expect(screen.queryByText('Private fleet')).not.toBeInTheDocument()
  })

  it('does not redirect while the login callback is being processed', () => {
    mockAuth({}, true)
    renderGuarded()
    expect(signinRedirect).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in')
  })

  it('does not redirect while the session is being restored', () => {
    mockAuth({ isLoading: true })
    renderGuarded()
    expect(signinRedirect).not.toHaveBeenCalled()
    expect(screen.queryByText('Private fleet')).not.toBeInTheDocument()
  })

  it('shows authentication errors without redirecting, and retries on request', async () => {
    mockAuth({ error: new Error('Login expired') as ReturnType<typeof useAuth>['error'] })
    renderGuarded()
    expect(screen.getByRole('alert')).toHaveTextContent('Login expired')
    expect(signinRedirect).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(signinRedirect).toHaveBeenCalledOnce()
  })

  it('renders the protected route for an authenticated user', () => {
    mockSignedIn()
    renderGuarded()
    expect(screen.getByText('Private fleet')).toBeInTheDocument()
    expect(signinRedirect).not.toHaveBeenCalled()
  })
})
