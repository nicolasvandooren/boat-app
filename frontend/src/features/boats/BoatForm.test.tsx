import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { axeViolations } from '../../test/axe'
import { mockSignedIn, signinRedirect } from '../../test/mockAuth'
import { BoatForm } from './BoatForm'
import type { BoatInput } from './boatInput'

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn(), hasAuthParams: vi.fn() }))

const onSubmit = vi.fn<(input: BoatInput) => void>()

function form(props: { isSubmitting?: boolean; serverError?: Error | null } = {}) {
  return (
    <MemoryRouter>
      <BoatForm
        initialValues={{ name: '', description: '' }}
        submitLabel="Add boat"
        isSubmitting={props.isSubmitting ?? false}
        serverError={props.serverError ?? null}
        onSubmit={onSubmit}
        cancelTo="/boats"
      />
    </MemoryRouter>
  )
}

function renderForm(props?: Parameters<typeof form>[0]) {
  const view = render(form(props))
  return { ...view, user: userEvent.setup() }
}

const nameField = () => screen.getByRole('textbox', { name: 'Name' })
const descriptionField = () => screen.getByRole('textbox', { name: 'Description' })
const submitButton = () => screen.getByRole('button', { name: 'Add boat' })

/** The text of the elements an element's aria-describedby points to. */
function description(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent)
    .join(' | ')
}

describe('BoatForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignedIn()
  })

  it('requires a name, shows the error next to the field and focuses it', async () => {
    const { user } = renderForm()
    await user.click(submitButton())

    expect(onSubmit).not.toHaveBeenCalled()
    expect(nameField()).toHaveAttribute('aria-invalid', 'true')
    expect(description(nameField())).toContain('Enter a name.')
    expect(nameField()).toHaveFocus()
  })

  it('rejects a whitespace-only name', async () => {
    const { user } = renderForm()
    await user.type(nameField(), '   ')
    await user.click(submitButton())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(description(nameField())).toContain('Enter a name.')
  })

  it('enforces the length limits on the values that are sent', async () => {
    const { user } = renderForm()
    await user.click(nameField())
    await user.paste('n'.repeat(151))
    await user.click(descriptionField())
    await user.paste('d'.repeat(2001))
    await user.click(submitButton())

    expect(onSubmit).not.toHaveBeenCalled()
    expect(description(nameField())).toContain('Name must be 150 characters or fewer.')
    expect(description(descriptionField())).toContain(
      'Description must be 2000 characters or fewer.',
    )
    expect(nameField()).toHaveFocus()
  })

  it('accepts the exact limits and submits the trimmed name and the description as entered', async () => {
    const { user } = renderForm()
    await user.click(nameField())
    await user.paste(`  ${'n'.repeat(150)}  `)
    await user.click(descriptionField())
    await user.paste(` ${'d'.repeat(1998)}\n`)

    expect(screen.getByText('150 / 150')).toBeInTheDocument()
    expect(screen.getByText('2000 / 2000')).toBeInTheDocument()
    await user.click(submitButton())
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'n'.repeat(150),
      description: ` ${'d'.repeat(1998)}\n`,
    })
  })

  it('sends an empty description as null and keeps a whitespace-only one', async () => {
    const { user } = renderForm()
    await user.type(nameField(), 'Gull')
    await user.click(submitButton())
    expect(onSubmit).toHaveBeenLastCalledWith({ name: 'Gull', description: null })

    await user.type(descriptionField(), '   ')
    await user.click(submitButton())
    expect(onSubmit).toHaveBeenLastCalledWith({ name: 'Gull', description: '   ' })
  })

  it('rejects NUL characters', async () => {
    const { user } = renderForm()
    await user.click(nameField())
    await user.paste('a\u0000b')
    await user.click(submitButton())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(description(nameField())).toContain('Name must not contain NUL characters.')
  })

  it('disables the fields and the button while saving', () => {
    renderForm({ isSubmitting: true })
    expect(nameField()).toBeDisabled()
    expect(descriptionField()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  it('shows recognized server field errors inline and focuses the first one', () => {
    const { rerender } = renderForm()
    rerender(
      form({
        serverError: new ApiError(400, {
          fieldErrors: [
            { field: 'description', message: 'size must be between 0 and 2000' },
            { field: 'name', message: 'must not be blank' },
          ],
        }),
      }),
    )
    expect(description(nameField())).toContain('Must not be blank.')
    expect(description(descriptionField())).toContain('Size must be between 0 and 2000.')
    expect(nameField()).toHaveFocus()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows unknown server field errors at form level and focuses the message', () => {
    const { rerender } = renderForm()
    rerender(
      form({
        serverError: new ApiError(400, { fieldErrors: [{ field: 'owner', message: 'is wrong' }] }),
      }),
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('The boat could not be saved (owner: is wrong).')
    expect(alert).toHaveFocus()
  })

  it('explains a 400 without usable field errors', () => {
    const { rerender } = renderForm()
    rerender(form({ serverError: new ApiError(400, { detail: 'Failed to read request' }) }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The boat could not be saved. Check the fields and try again. Failed to read request.',
    )
  })

  it('offers to sign in again after a 401 without redirecting', async () => {
    const { rerender, user } = renderForm()
    rerender(form({ serverError: new ApiError(401) }))
    expect(screen.getByRole('alert')).toHaveTextContent('Your session has expired.')
    expect(signinRedirect).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(signinRedirect).toHaveBeenCalledOnce()
  })

  it('explains a 404 and a network error without technical details', () => {
    const { rerender } = renderForm()
    rerender(form({ serverError: new ApiError(404, { detail: 'No boat with id 123' }) }))
    expect(screen.getByRole('alert')).toHaveTextContent('This boat no longer exists.')
    expect(screen.getByRole('link', { name: 'Go to the fleet' })).toHaveAttribute('href', '/boats')

    rerender(form({ serverError: new TypeError('Failed to fetch') }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not save the boat. Please try again.',
    )
    expect(screen.queryByText(/Failed to fetch|No boat with id/)).not.toBeInTheDocument()
  })

  it('has no automatically detectable accessibility violations (empty and with errors)', async () => {
    const { container, user } = renderForm()
    expect(await axeViolations(container)).toEqual([])
    await user.click(submitButton())
    expect(await axeViolations(container)).toEqual([])
  })
})
