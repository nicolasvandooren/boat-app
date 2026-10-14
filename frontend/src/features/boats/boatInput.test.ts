import { describe, expect, it } from 'vitest'
import { DESCRIPTION_MAX, NAME_MAX, toBoatInput, validateBoat } from './boatInput'

describe('toBoatInput', () => {
  it('trims the name and sends an empty description as null', () => {
    expect(toBoatInput({ name: '  Gull \n', description: '' })).toEqual({
      name: 'Gull',
      description: null,
    })
  })

  it('keeps any non-empty description exactly as entered, including whitespace-only', () => {
    expect(toBoatInput({ name: 'Gull', description: '   ' }).description).toBe('   ')
    expect(toBoatInput({ name: 'Gull', description: ' Line 1\n\nLine 2 ' }).description).toBe(
      ' Line 1\n\nLine 2 ',
    )
  })
})

describe('validateBoat', () => {
  const valid = { name: 'Gull', description: '' }

  it('accepts valid values and the exact limits', () => {
    expect(validateBoat(valid)).toEqual({})
    expect(
      validateBoat({ name: 'n'.repeat(NAME_MAX), description: 'd'.repeat(DESCRIPTION_MAX) }),
    ).toEqual({})
  })

  it('requires a name that is not blank after trimming', () => {
    expect(validateBoat({ ...valid, name: '' }).name).toBe('Enter a name.')
    expect(validateBoat({ ...valid, name: ' \t\n ' }).name).toBe('Enter a name.')
  })

  it('measures the name after trimming, like the server', () => {
    expect(validateBoat({ ...valid, name: `  ${'n'.repeat(NAME_MAX)}  ` })).toEqual({})
    expect(validateBoat({ ...valid, name: 'n'.repeat(NAME_MAX + 1) }).name).toBe(
      'Name must be 150 characters or fewer.',
    )
  })

  it('measures the description as sent, without trimming', () => {
    expect(
      validateBoat({ ...valid, description: ` ${'d'.repeat(DESCRIPTION_MAX)}` }).description,
    ).toBe('Description must be 2000 characters or fewer.')
  })

  it('counts UTF-16 code units like the server (an emoji counts twice)', () => {
    expect(validateBoat({ ...valid, name: '⛵'.repeat(NAME_MAX) })).toEqual({})
    expect(validateBoat({ ...valid, name: '🚤'.repeat(76) }).name).toMatch(/150 characters/)
  })

  it('rejects NUL characters in either field', () => {
    expect(validateBoat({ name: 'a\u0000b', description: 'c\u0000d' })).toEqual({
      name: 'Name must not contain NUL characters.',
      description: 'Description must not contain NUL characters.',
    })
  })
})
