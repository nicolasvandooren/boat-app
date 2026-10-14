import { useAuth } from 'react-oidc-context'
import { ApiError } from '../../api/client'
import styles from './BoatsPage.module.css'

interface LoadErrorProps {
  /** What failed to load, e.g. "boats" or "this boat". */
  what: string
  error: Error
  onRetry: () => void
}

/** Error state shared by the boat pages: session expiry, or a generic failure with Retry. */
export function LoadError({ what, error, onRetry }: LoadErrorProps) {
  const auth = useAuth()

  if (error instanceof ApiError && error.status === 401) {
    // No automatic redirect: a 401 here must never start a login loop.
    return (
      <div className={styles.notice}>
        <p role="alert">Your session has expired.</p>
        <button type="button" onClick={() => void auth.signinRedirect()}>
          Sign in again
        </button>
      </div>
    )
  }

  // Only 400 details are shown: they describe the request and never echo submitted values.
  const detail = error instanceof ApiError && error.status === 400 ? error.detail : undefined
  return (
    <div className={styles.notice}>
      <p role="alert">
        Could not load {what}. {detail ?? 'Please try again.'}
      </p>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}
