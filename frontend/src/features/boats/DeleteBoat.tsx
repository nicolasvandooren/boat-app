import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { useDeleteBoat } from './api'
import type { BoatNavState } from './navigation'
import type { Boat } from './types'
import styles from './BoatDetailPage.module.css'

function DeleteError({ error }: { error: Error }) {
  const auth = useAuth()
  if (error instanceof ApiError && error.status === 401) {
    // No automatic redirect: the user decides when to leave for the sign-in page.
    return (
      <p role="alert">
        Your session has expired.{' '}
        <button type="button" onClick={() => void auth.signinRedirect()}>
          Sign in again
        </button>
      </p>
    )
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <p role="alert">
        This boat was already deleted. <Link to="/boats">Go to the fleet</Link>
      </p>
    )
  }
  return <p role="alert">Could not delete the boat. Please try again.</p>
}

/**
 * "Delete boat" with an inline confirmation instead of window.confirm(): it names the boat, gets focus when it
 * opens (so screen readers announce it), closes with Cancel or Escape without any request, and returns focus to
 * the Delete button.
 */
export function DeleteBoat({ boat, listSearch }: { boat: Boat; listSearch: string }) {
  const id = useId()
  const navigate = useNavigate()
  const remove = useDeleteBoat(boat.id)
  const [confirming, setConfirming] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)

  // Move focus into the confirmation when it opens and back to the opener when it closes.
  useEffect(() => {
    if (confirming) panelRef.current?.focus()
    else if (wasConfirming.current) openerRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  const cancel = () => {
    if (remove.isPending) return
    remove.reset()
    setConfirming(false)
  }

  const confirm = () => {
    if (remove.isPending) return
    remove.mutate(undefined, {
      onSuccess: () => {
        const state: BoatNavState = { notice: 'deleted', deletedName: boat.name }
        void navigate(`/boats${listSearch}`, { replace: true, state })
      },
    })
  }

  // Escape anywhere inside the open confirmation cancels it.
  const onEscape = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.key === 'Escape') cancel()
  })
  useEffect(() => {
    const panel = panelRef.current
    if (!confirming || !panel) return undefined
    panel.addEventListener('keydown', onEscape)
    return () => {
      panel.removeEventListener('keydown', onEscape)
    }
  }, [confirming])

  if (!confirming) {
    return (
      <button
        ref={openerRef}
        type="button"
        className={styles.danger}
        onClick={() => {
          setConfirming(true)
        }}
      >
        Delete boat
      </button>
    )
  }

  return (
    <div
      ref={panelRef}
      className={styles.confirm}
      role="group"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      tabIndex={-1}
    >
      <h2 id={`${id}-title`}>Delete “{boat.name}”?</h2>
      <p id={`${id}-text`}>This permanently removes the boat. It cannot be undone.</p>
      {remove.error && <DeleteError error={remove.error} />}
      <div className={styles.confirmActions}>
        <button
          type="button"
          className={styles.danger}
          disabled={remove.isPending}
          onClick={confirm}
        >
          {remove.isPending ? 'Deleting…' : 'Delete permanently'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={remove.isPending}
          onClick={cancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
