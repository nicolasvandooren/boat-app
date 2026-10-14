import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { apiGet } from '../api/client'

interface Me {
  subject: string
  username: string
}

export function HomePage() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token
  const [me, setMe] = useState<Me | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return undefined
    let cancelled = false
    apiGet<Me>('/api/me', accessToken)
      .then((result) => {
        if (!cancelled) setMe(result)
      })
      .catch((error: unknown) => {
        if (!cancelled) setApiError(error instanceof Error ? error.message : 'Unknown error')
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  if (auth.isLoading) {
    return <p role="status">Loading…</p>
  }

  if (auth.error) {
    return <p role="alert">Authentication error: {auth.error.message}</p>
  }

  if (!auth.isAuthenticated) {
    return (
      <section>
        <h1>The Boat App</h1>
        <p>Please log in to manage your boats.</p>
        <button type="button" onClick={() => void auth.signinRedirect()}>
          Log in
        </button>
      </section>
    )
  }

  return (
    <section>
      <h1>The Boat App</h1>
      {apiError && <p role="alert">Could not reach the API: {apiError}</p>}
      {!apiError && !me && <p role="status">Loading profile…</p>}
      {me && <p>Signed in as {me.username}</p>}
      <button type="button" onClick={() => void auth.signoutRedirect()}>
        Log out
      </button>
    </section>
  )
}
