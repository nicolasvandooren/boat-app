import { Link, useLocation, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useDocumentTitle } from '../../components/useDocumentTitle'
import { LoadError } from './LoadError'
import { isBoatId, useBoat } from './api'
import { backToFleet, listSearchFrom, noticeFrom, type BoatNavState } from './navigation'
import styles from './BoatDetailPage.module.css'
import listStyles from './BoatsPage.module.css'

const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' })

/** Shown below the page's "Back to fleet" link, which is the way out. */
export function BoatNotFound() {
  useDocumentTitle('Boat not found')
  return (
    <div className={listStyles.notice}>
      <h1>Boat not found</h1>
      <p>This boat does not exist or is no longer available.</p>
    </div>
  )
}

const NOTICES = { created: 'Boat added.', saved: 'Changes saved.' }

function BoatDetail({ id, navState }: { id: string; navState: BoatNavState }) {
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
    <>
      {navState.notice && (
        // Focused after navigation (see Layout), so the confirmation is read out first.
        <p role="status" className={styles.notice} tabIndex={-1} data-focus-on-navigate>
          {NOTICES[navState.notice]}
        </p>
      )}
      <article className={styles.detail}>
        <div className={styles.titleRow}>
          <h1 className={styles.name}>{boat.name}</h1>
          <Link
            className="button-link secondary"
            to={`/boats/${boat.id}/edit`}
            state={{ listSearch: navState.listSearch } satisfies BoatNavState}
          >
            Edit boat
          </Link>
        </div>
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
              <time dateTime={boat.createdAt}>
                {dateTimeFormat.format(new Date(boat.createdAt))}
              </time>
            </dd>
          </div>
        </dl>
      </article>
    </>
  )
}

export function BoatDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const backTo = backToFleet(location.state)
  const navState: BoatNavState = {
    listSearch: listSearchFrom(location.state),
    notice: noticeFrom(location.state),
  }

  return (
    <>
      <p className={styles.back}>
        <Link to={backTo}>
          <span aria-hidden="true">←</span>Back to fleet
        </Link>
      </p>
      {isBoatId(id) ? <BoatDetail id={id} navState={navState} /> : <BoatNotFound />}
    </>
  )
}
