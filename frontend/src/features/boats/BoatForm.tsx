import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SubmitEvent,
} from 'react'
import { useAuth } from 'react-oidc-context'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import {
  DESCRIPTION_MAX,
  NAME_MAX,
  toBoatInput,
  validateBoat,
  type BoatField,
  type BoatFieldErrors,
  type BoatFormValues,
  type BoatInput,
} from './boatInput'
import styles from './BoatForm.module.css'

const FIELDS: BoatField[] = ['name', 'description']

interface BoatFormProps {
  /** Which flow owns the form. A 404 means "this boat is gone" only when editing. */
  mode: 'create' | 'edit'
  initialValues: BoatFormValues
  submitLabel: string
  /** True while the save request is in flight: fields and submit are disabled. */
  isSubmitting: boolean
  /** The last failed save, or null. Cleared by the mutation when the next save starts. */
  serverError: Error | null
  onSubmit: (input: BoatInput) => void
  cancelTo: string
  cancelState?: unknown
}

/** "must not be blank" → "Must not be blank." */
function sentence(message: string) {
  const text = message.charAt(0).toUpperCase() + message.slice(1)
  return /[.!?]$/.test(text) ? text : `${text}.`
}

function isBoatField(field: string): field is BoatField {
  return (FIELDS as string[]).includes(field)
}

/** Splits a save failure into errors shown next to fields and an optional form-level message. */
function describeServerError(
  error: Error | null,
  signIn: () => void,
  mode: 'create' | 'edit',
): { fields: BoatFieldErrors; message: ReactNode } {
  if (!error) return { fields: {}, message: null }

  if (error instanceof ApiError && error.status === 400) {
    const fields: BoatFieldErrors = {}
    const unknown: string[] = []
    for (const { field, message } of error.fieldErrors ?? []) {
      if (isBoatField(field)) fields[field] ??= sentence(message)
      else unknown.push(`${field}: ${message}`)
    }
    if (unknown.length > 0) {
      return { fields, message: `The boat could not be saved (${unknown.join('; ')}).` }
    }
    if (Object.keys(fields).length > 0) return { fields, message: null }
    // A 400 without usable field errors, e.g. malformed JSON.
    return {
      fields,
      message: `The boat could not be saved. Check the fields and try again.${error.detail ? ` ${sentence(error.detail)}` : ''}`,
    }
  }

  if (error instanceof ApiError && error.status === 401) {
    // No automatic redirect: signing in is a full page load, so the user decides when to leave the form.
    return {
      fields: {},
      message: (
        <>
          Your session has expired. Sign in again to continue; unsaved changes will be lost.{' '}
          <button type="button" className={styles.inlineButton} onClick={signIn}>
            Sign in again
          </button>
        </>
      ),
    }
  }

  if (error instanceof ApiError && error.status === 404) {
    // Only editing an existing boat can hit a "boat is gone" 404; a 404 from creating it is just a failed
    // save, so it must not claim an existing boat was deleted or push the user to abandon their input.
    if (mode === 'edit') {
      return {
        fields: {},
        message: (
          <>
            This boat no longer exists. <Link to="/boats">Go to the fleet</Link>
          </>
        ),
      }
    }
    return { fields: {}, message: 'Could not save the boat. Please try again.' }
  }

  return { fields: {}, message: 'Could not save the boat. Please try again.' }
}

/** Shared create/edit form. Validation mirrors the server (see boatInput.ts); native validation is off. */
export function BoatForm({
  mode,
  initialValues,
  submitLabel,
  isSubmitting,
  serverError,
  onSubmit,
  cancelTo,
  cancelState,
}: BoatFormProps) {
  const auth = useAuth()
  const id = useId()
  const [values, setValues] = useState(initialValues)
  const [clientErrors, setClientErrors] = useState<BoatFieldErrors>({})
  const inputs = useRef<Partial<Record<BoatField, HTMLInputElement | HTMLTextAreaElement | null>>>(
    {},
  )
  const alertRef = useRef<HTMLDivElement>(null)

  const server = describeServerError(serverError, () => void auth.signinRedirect(), mode)
  const errors: BoatFieldErrors = { ...server.fields, ...clientErrors }
  const submitted = toBoatInput(values)

  // When a save fails, move focus to the first field the server rejected, or to the form-level message.
  // Only a new error moves focus, not re-renders while it is shown.
  const focusServerError = useEffectEvent(() => {
    const firstField = FIELDS.find((field) => server.fields[field])
    if (firstField) inputs.current[firstField]?.focus()
    else alertRef.current?.focus()
  })
  useEffect(() => {
    if (serverError) focusServerError()
  }, [serverError])

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    const found = validateBoat(values)
    setClientErrors(found)
    const firstInvalid = FIELDS.find((field) => found[field])
    if (firstInvalid) {
      inputs.current[firstInvalid]?.focus()
      return
    }
    onSubmit(submitted)
  }

  const change = (field: BoatField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    // An edited field's client error is re-checked on the next submit.
    setClientErrors((current) => ({ ...current, [field]: undefined }))
  }

  const describedBy = (field: BoatField) =>
    [`${id}-${field}-hint`, `${id}-${field}-count`, errors[field] && `${id}-${field}-error`]
      .filter(Boolean)
      .join(' ')

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      {server.message && (
        <div ref={alertRef} className={styles.alert} role="alert" tabIndex={-1}>
          {server.message}
        </div>
      )}
      <div className={styles.field}>
        <label htmlFor={`${id}-name`}>Name</label>
        <p id={`${id}-name-hint`} className={styles.hint}>
          Required, up to {NAME_MAX} characters.
        </p>
        <input
          id={`${id}-name`}
          ref={(element) => {
            inputs.current.name = element
          }}
          type="text"
          required
          disabled={isSubmitting}
          autoComplete="off"
          value={values.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy('name')}
          onChange={(event) => {
            change('name', event.target.value)
          }}
        />
        <div className={styles.below}>
          {errors.name ? (
            <p id={`${id}-name-error`} className={styles.error}>
              {errors.name}
            </p>
          ) : (
            <span />
          )}
          <p id={`${id}-name-count`} className={styles.count}>
            {submitted.name.length} / {NAME_MAX}
          </p>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${id}-description`}>Description</label>
        <p id={`${id}-description-hint`} className={styles.hint}>
          Optional, up to {DESCRIPTION_MAX} characters.
        </p>
        <textarea
          id={`${id}-description`}
          ref={(element) => {
            inputs.current.description = element
          }}
          rows={6}
          disabled={isSubmitting}
          value={values.description}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy('description')}
          onChange={(event) => {
            change('description', event.target.value)
          }}
        />
        <div className={styles.below}>
          {errors.description ? (
            <p id={`${id}-description-error`} className={styles.error}>
              {errors.description}
            </p>
          ) : (
            <span />
          )}
          <p id={`${id}-description-count`} className={styles.count}>
            {values.description.length} / {DESCRIPTION_MAX}
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
        <Link className="button-link secondary" to={cancelTo} state={cancelState}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
