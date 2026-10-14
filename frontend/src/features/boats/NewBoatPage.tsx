import { useLocation, useNavigate } from 'react-router'
import { useDocumentTitle } from '../../components/useDocumentTitle'
import { BoatForm } from './BoatForm'
import { useCreateBoat } from './api'
import { backToFleet, listSearchFrom, type BoatNavState } from './navigation'

const EMPTY = { name: '', description: '' }

export function NewBoatPage() {
  useDocumentTitle('Add boat')
  const location = useLocation()
  const navigate = useNavigate()
  const create = useCreateBoat()

  return (
    <>
      <h1>Add boat</h1>
      <BoatForm
        initialValues={EMPTY}
        submitLabel="Add boat"
        isSubmitting={create.isPending}
        serverError={create.error}
        cancelTo={backToFleet(location.state)}
        onSubmit={(input) => {
          create.mutate(input, {
            onSuccess: (boat) => {
              // replace: Back from the new boat goes to the fleet, not to the submitted form.
              const state: BoatNavState = {
                listSearch: listSearchFrom(location.state),
                notice: 'created',
              }
              void navigate(`/boats/${boat.id}`, { replace: true, state })
            },
          })
        }}
      />
    </>
  )
}
