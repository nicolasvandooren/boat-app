import { useCallback } from 'react'
import { useAuth } from 'react-oidc-context'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../../api/client'
import { BoatSearch } from './BoatSearch'
import { parseListParams, useBoats } from './api'
import type { Boat, BoatPage } from './types'
import styles from './BoatsPage.module.css'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

function countLabel(count: number) {
  return `${count} ${count === 1 ? 'boat' : 'boats'}`
}

function BoatCard({ boat }: { boat: Boat }) {
  return (
    <li className={styles.card}>
      <article>
        <h2 className={styles.cardTitle}>{boat.name}</h2>
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

function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
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
      <p role="alert">Could not load boats. {detail ?? 'Please try again.'}</p>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

function summary(data: BoatPage | undefined, isPending: boolean, search: string) {
  if (isPending) return 'Loading boats…'
  if (!data) return ''
  const count = countLabel(data.totalElements)
  return search ? `${count} match “${search}”` : count
}

export function BoatsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
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
            <BoatCard key={boat.id} boat={boat} />
          ))}
        </ul>
        <Pagination page={data.page} totalPages={data.totalPages} linkTo={linkTo} />
      </>
    )
  }

  return (
    <section aria-labelledby="fleet-heading">
      <div className={styles.header}>
        <h1 id="fleet-heading">Fleet overview</h1>
        <BoatSearch search={search} onSearch={updateSearch} />
      </div>
      {/* Always rendered, so screen readers announce changes in the result count. */}
      <p role="status" className={styles.summary}>
        {summary(data, isPending && !error, search)}
      </p>
      {renderContent()}
    </section>
  )
}
