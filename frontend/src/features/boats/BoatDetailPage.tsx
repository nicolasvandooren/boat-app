import { Link, useLocation, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useDocumentTitle } from '../../components/useDocumentTitle'
import { LoadError } from './LoadError'
import { isBoatId, useBoat } from './api'
import styles from './BoatDetailPage.module.css'
import listStyles from './BoatsPage.module.css'

const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' })

/**
 * The list URL the user came from, passed as location state by the fleet cards. Only a plain query string is
 * accepted; anything else (direct visit, refresh in a new tab, foreign state) falls back to the first page.
 */
function backToFleet(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'listSearch' in state) {
    const { listSearch } = state
    if (typeof listSearch === 'string' && /^(\?[^#]*)?$/.test(listSearch)) {
      return `/boats${listSearch}`
    }
  }
  return '/boats'
}

/** Shown below the page's "Back to fleet" link, which is the way out. */
function BoatNotFound() {
  useDocumentTitle('Boat not found')
  return (
    <div className={listStyles.notice}>
      <h1>Boat not found</h1>
      <p>This boat does not exist or is no longer available.</p>
    </div>
  )
}

function BoatDetail({ id }: { id: string }) {
  const { data: boat, error, refetch } = useBoat(id)
  useDocumentTitle(boat?.name ?? 'Boat details')

  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return <BoatNotFound />
    }
    return (
      <LoadError
        what="this boat"
        error={error}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  if (!boat) {
    return <p role="status">Loading boat…</p>
  }

  return (
    <article className={styles.detail}>
      <h1 className={styles.name}>{boat.name}</h1>
      <dl className={styles.fields}>
        <div>
          <dt>Description</dt>
          {boat.description ? (
            <dd className={styles.description}>{boat.description}</dd>
          ) : (
            <dd className={listStyles.muted}>No description</dd>
          )}
        </div>
        <div>
          <dt>Added</dt>
          <dd>
            <time dateTime={boat.createdAt}>{dateTimeFormat.format(new Date(boat.createdAt))}</time>
          </dd>
        </div>
      </dl>
    </article>
  )
}

export function BoatDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const backTo = backToFleet(location.state)

  return (
    <>
      <p className={styles.back}>
        <Link to={backTo}>
          <span aria-hidden="true">← </span>Back to fleet
        </Link>
      </p>
      {isBoatId(id) ? <BoatDetail id={id} /> : <BoatNotFound />}
    </>
  )
}
