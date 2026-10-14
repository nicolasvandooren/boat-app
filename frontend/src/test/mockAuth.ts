import { hasAuthParams, useAuth } from 'react-oidc-context'
import { vi } from 'vitest'

type AuthState = ReturnType<typeof useAuth>

// Test files call vi.mock('react-oidc-context', () => ({ useAuth: vi.fn(), hasAuthParams: vi.fn() })).
export const signinRedirect = vi.fn(() => Promise.resolve())
export const signoutRedirect = vi.fn(() => Promise.resolve())

export const demoUser = { profile: { sub: 'user-1', preferred_username: 'demo' } }

export function mockAuth(state: Partial<AuthState> = {}, callbackParamsInUrl = false) {
  vi.mocked(hasAuthParams).mockReturnValue(callbackParamsInUrl)
  vi.mocked(useAuth).mockReturnValue({
    isLoading: false,
    isAuthenticated: false,
    activeNavigator: undefined,
    error: undefined,
    user: undefined,
    signinRedirect,
    signoutRedirect,
    ...state,
  } as AuthState)
}

export function mockSignedIn(
  user: { profile: { sub: string; preferred_username: string } } = demoUser,
) {
  mockAuth({ isAuthenticated: true, user: user as AuthState['user'] })
}
