import { useAuth } from 'react-oidc-context'
import { Link } from 'react-router'

/** Public landing page after logout. It never signs in automatically, so logout sticks. */
export function SignedOutPage() {
  const auth = useAuth()

  if (auth.isAuthenticated) {
    return (
      <section>
        <h1>You are signed in</h1>
        <Link to="/boats">Go to your fleet</Link>
      </section>
    )
  }

  return (
    <section>
      <h1>You have been signed out</h1>
      <p>Your session has ended. Sign in again to manage your boats.</p>
      <button type="button" onClick={() => void auth.signinRedirect()}>
        Sign in again
      </button>
    </section>
  )
}
