import { useCallback } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useDocumentTitle } from '../../components/useDocumentTitle'
import { BoatSearch } from './BoatSearch'
import { LoadError } from './LoadError'
import { parseListParams, useBoats } from './api'
import { deletedNameFrom, noticeFrom, type BoatNavState } from './navigation'
import type { Boat, BoatPage } from './types'
import styles from './BoatsPage.module.css'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

function countLabel(count: number) {
  return `${count} ${count === 1 ? 'boat' : 'boats'}`
}

function BoatCard({ boat, listSearch }: { boat: Boat; listSearch: string }) {
  const state: BoatNavState = { listSearch }
  return (
    <li className={styles.card}>
      <article>
        <h2 className={styles.cardTitle}>
          {/* The only interactive element; its ::after stretches the click target over the card. */}
          <Link className={styles.cardLink} to={`/boats/${boat.id}`} state={state}>
            {boat.name}
          </Link>
        </h2>
        {boat.description ? (
          <p className={styles.description}>{boat.description}</p>
        ) : (
          <p className={styles.muted}>No description</p>
        )}
        <p className={styles.meta}>
          Added <time dateTime={boat.createdAt}>{dateFormat.format(new Date(boat.createdAt))}</time>
        </p>
      </article>
    </li>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  linkTo: (page: number) => string
}

function Pagination({ page, totalPages, linkTo }: PaginationProps) {
  if (totalPages <= 1) return null
  const hasPrevious = page > 0
  const hasNext = page < totalPages - 1

  return (
    <nav aria-label="Pagination" className={styles.pagination}>
      {hasPrevious ? (
        <Link to={linkTo(page - 1)} rel="prev">
          Previous page
        </Link>
      ) : (
        <span aria-disabled="true">Previous page</span>
      )}
      <span>
        Page {page + 1} of {totalPages}
      </span>
      {hasNext ? (
        <Link to={linkTo(page + 1)} rel="next">
          Next page
        </Link>
      ) : (
        <span aria-disabled="true">Next page</span>
      )}
    </nav>
  )
}

function summary(data: BoatPage | undefined, isPending: boolean, search: string) {
  if (isPending) return 'Loading boats…'
  if (!data) return ''
  const count = countLabel(data.totalElements)
  if (!search) return count
  return `${count} ${data.totalElements === 1 ? 'matches' : 'match'} “${search}”`
}

export function BoatsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const newBoatState: BoatNavState = { listSearch: location.search }
  const deleted = noticeFrom(location.state) === 'deleted'
  const deletedName = deletedNameFrom(location.state)
  useDocumentTitle('Fleet overview')
  const { page, search } = parseListParams(searchParams)
  const { data, error, isPending, isPlaceholderData, refetch } = useBoats({ page, search })

  const updateSearch = useCallback(
    (next: string) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current)
          if (next) params.set('search', next)
          else params.delete('search')
          params.delete('page')
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const linkTo = (target: number) => {
    const params = new URLSearchParams(searchParams)
    if (target > 0) params.set('page', String(target))
    else params.delete('page')
    return `?${params.toString()}`
  }

  const renderContent = () => {
    if (error) {
      return (
        <LoadError
          what="boats"
          error={error}
          onRetry={() => {
            void refetch()
          }}
        />
      )
    }
    if (!data) return null

    if (data.content.length === 0) {
      if (data.totalElements > 0) {
        return (
          <div className={styles.notice}>
            <p>This page does not exist.</p>
            <Link to={linkTo(0)}>Go to the first page</Link>
          </div>
        )
      }
      if (search) {
        return (
          <div className={styles.notice}>
            <p>No boats match “{search}”.</p>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                updateSearch('')
              }}
            >
              Clear search
            </button>
          </div>
        )
      }
      return (
        <div className={styles.notice}>
          <p>Your fleet is empty. No boats have been added yet.</p>
          <Link className="button-link" to="/boats/new" state={newBoatState}>
            Add your first boat
          </Link>
        </div>
      )
    }

    return (
      <>
        <ul
          className={isPlaceholderData ? `${styles.grid} ${styles.updating}` : styles.grid}
          aria-busy={isPlaceholderData}
        >
          {data.content.map((boat) => (
            <BoatCard key={boat.id} boat={boat} listSearch={location.search} />
          ))}
        </ul>
        <Pagination page={data.page} totalPages={data.totalPages} linkTo={linkTo} />
      </>
    )
  }

  return (
    <section aria-labelledby="fleet-heading">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 id="fleet-heading">Fleet overview</h1>
          <Link className="button-link" to="/boats/new" state={newBoatState}>
            Add boat
          </Link>
        </div>
        <BoatSearch search={search} onSearch={updateSearch} />
      </div>
      {deleted && (
        // Focused after navigation (see Layout), so the confirmation is read out first.
        <p role="status" className={styles.success} tabIndex={-1} data-focus-on-navigate>
          {deletedName ? `“${deletedName}” was deleted.` : 'Boat deleted.'}
        </p>
      )}
      {/* Always rendered, so screen readers announce changes in the result count. */}
      <p role="status" className={styles.summary}>
        {summary(data, isPending && !error, search)}
      </p>
      {renderContent()}
    </section>
  )
}
