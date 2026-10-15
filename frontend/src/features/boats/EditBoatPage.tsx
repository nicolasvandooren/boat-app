import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useDocumentTitle } from '../../components/useDocumentTitle'
import { BoatForm } from './BoatForm'
import { BoatNotFound } from './BoatDetailPage'
import { LoadError } from './LoadError'
import { isBoatId, useBoat, useUpdateBoat } from './api'
import { listSearchFrom, type BoatNavState } from './navigation'
import type { Boat } from './types'

function EditForm({ boat, listSearch }: { boat: Boat; listSearch: string }) {
  useDocumentTitle(`Edit ${boat.name}`)
  const navigate = useNavigate()
  const update = useUpdateBoat(boat.id)
  const detailState: BoatNavState = { listSearch }

  return (
    <>
      <h1>Edit {boat.name}</h1>
      <BoatForm
        initialValues={{ name: boat.name, description: boat.description ?? '' }}
        submitLabel="Save changes"
        isSubmitting={update.isPending}
        serverError={update.error}
        cancelTo={`/boats/${boat.id}`}
        cancelState={detailState}
        onSubmit={(input) => {
          update.mutate(input, {
            onSuccess: (saved) => {
              const state: BoatNavState = { listSearch, notice: 'saved' }
              void navigate(`/boats/${saved.id}`, { replace: true, state })
            },
          })
        }}
      />
    </>
  )
}

/** Not found (unknown or malformed id), with a way back that works even on a direct visit. */
function EditNotFound({ listSearch }: { listSearch: string }) {
  return (
    <>
      <BoatNotFound />
      <p>
        <Link to={`/boats${listSearch}`}>Back to fleet</Link>
      </p>
    </>
  )
}

function EditLoader({ id, listSearch }: { id: string; listSearch: string }) {
  const { data: boat, error, refetch } = useBoat(id)
  const retry = () => {
    void refetch()
  }

  if (boat) {
    // A failed background refetch (e.g. on window focus) keeps the cached boat: the form stays mounted so the
    // user's unsaved input survives, and the failure is reported above it. Saving reports its own errors.
    return (
      <>
        {error && <LoadError what="this boat" error={error} onRetry={retry} stale />}
        {/* Mounted only once the boat is loaded, so the form's initial values never need syncing. */}
        <EditForm key={boat.id} boat={boat} listSearch={listSearch} />
      </>
    )
  }
  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return <EditNotFound listSearch={listSearch} />
    }
    return <LoadError what="this boat" error={error} onRetry={retry} />
  }
  return <p role="status">Loading boat…</p>
}

export function EditBoatPage() {
  const { id } = useParams()
  const listSearch = listSearchFrom(useLocation().state)
  if (!isBoatId(id)) return <EditNotFound listSearch={listSearch} />
  return <EditLoader id={id} listSearch={listSearch} />
}
