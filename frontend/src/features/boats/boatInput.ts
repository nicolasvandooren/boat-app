/**
 * Form values and their mapping to the API body, with validation that mirrors BoatRequest (backend/README.md):
 * the server strips the name, then requires it non-blank and at most 150 characters; the description is
 * optional, at most 2000 characters and stored as sent; neither may contain NUL. Lengths are UTF-16 code units
 * on both sides (Bean Validation @Size and JavaScript string length).
 */
export const NAME_MAX = 150
export const DESCRIPTION_MAX = 2000

export interface BoatFormValues {
  name: string
  description: string
}

/** Request body of POST/PUT /api/boats. */
export interface BoatInput {
  name: string
  description: string | null
}

export type BoatField = keyof BoatFormValues
export type BoatFieldErrors = Partial<Record<BoatField, string>>

/** The exact body sent to the API: trimmed name; an empty description becomes null, anything else is kept as is. */
export function toBoatInput(values: BoatFormValues): BoatInput {
  return {
    name: values.name.trim(),
    description: values.description === '' ? null : values.description,
  }
}

const NUL = '\u0000'

/** Validates the values that toBoatInput would send. Returns an empty object when they are valid. */
export function validateBoat(values: BoatFormValues): BoatFieldErrors {
  const { name, description } = toBoatInput(values)
  const errors: BoatFieldErrors = {}

  if (name === '') errors.name = 'Enter a name.'
  else if (name.length > NAME_MAX) errors.name = `Name must be ${NAME_MAX} characters or fewer.`
  else if (name.includes(NUL)) errors.name = 'Name must not contain NUL characters.'

  if (description !== null) {
    if (description.length > DESCRIPTION_MAX) {
      errors.description = `Description must be ${DESCRIPTION_MAX} characters or fewer.`
    } else if (description.includes(NUL)) {
      errors.description = 'Description must not contain NUL characters.'
    }
  }
  return errors
}
