import { useEffect, useRef } from 'react'
import { hasAuthParams, useAuth } from 'react-oidc-context'
import { Outlet } from 'react-router'

/**
 * Protects child routes: anonymous visitors are sent to Keycloak, and nothing private renders
 * until the session is established. Login always lands on /boats (the callback returns to /).
 */
export function RequireAuth() {
  const auth = useAuth()
  // A ref (not state) survives StrictMode's effect replay, so one visit triggers one redirect.
  const redirected = useRef(false)

  const shouldRedirect =
    !auth.isAuthenticated &&
    !auth.isLoading &&
    !auth.activeNavigator &&
    !auth.error &&
    !hasAuthParams()

  useEffect(() => {
    if (auth.isAuthenticated) {
      // Allow one new redirect if this session ends later (logout elsewhere, failed renewal).
      redirected.current = false
    } else if (shouldRedirect && !redirected.current) {
      redirected.current = true
      void auth.signinRedirect()
    }
  }, [auth, shouldRedirect])

  if (auth.isAuthenticated) {
    return <Outlet />
  }

  if (auth.error) {
    return (
      <section>
        <h1>Sign-in failed</h1>
        <p role="alert">{auth.error.message}</p>
        <button type="button" onClick={() => void auth.signinRedirect()}>
          Try again
        </button>
      </section>
    )
  }

  return <p role="status">Signing you in…</p>
}
