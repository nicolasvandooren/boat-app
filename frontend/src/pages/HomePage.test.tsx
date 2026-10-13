import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuth } from 'react-oidc-context'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn() }))

const signinRedirect = vi.fn()

function mockAuth(state: Partial<ReturnType<typeof useAuth>>) {
  vi.mocked(useAuth).mockReturnValue({
    isLoading: false,
    isAuthenticated: false,
    signinRedirect,
    ...state,
  } as ReturnType<typeof useAuth>)
}

describe('HomePage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state while the session is restored', () => {
    mockAuth({ isLoading: true })
    render(<HomePage />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
  })

  it('starts the OIDC login when the user is anonymous', async () => {
    mockAuth({})
    render(<HomePage />)
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(signinRedirect).toHaveBeenCalledOnce()
  })

  it('shows authentication errors', () => {
    mockAuth({ error: new Error('boom') as ReturnType<typeof useAuth>['error'] })
    render(<HomePage />)
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
  })
})
