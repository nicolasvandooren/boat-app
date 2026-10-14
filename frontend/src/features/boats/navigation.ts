/**
 * Location state passed between the boat pages, so "Back to fleet" and Cancel can return to the list page and
 * search the user came from. Everything is optional and validated: a direct visit, a new tab or foreign state
 * simply falls back to /boats. No global state is involved.
 */
export interface BoatNavState {
  /** The fleet URL's query string, e.g. "?search=pearl&page=1" (or "" for the first page). */
  listSearch?: string
  /** Set after a successful save; the detail page confirms it. */
  notice?: BoatNotice
}

export type BoatNotice = 'created' | 'saved'

function field(state: unknown, key: keyof BoatNavState): unknown {
  return typeof state === 'object' && state !== null && key in state
    ? (state as Record<string, unknown>)[key]
    : undefined
}

/** The list query string from `state`, or "" when there is none or it is not a plain query string. */
export function listSearchFrom(state: unknown): string {
  const listSearch = field(state, 'listSearch')
  return typeof listSearch === 'string' && /^(\?[^#]*)?$/.test(listSearch) ? listSearch : ''
}

export function backToFleet(state: unknown): string {
  return `/boats${listSearchFrom(state)}`
}

export function noticeFrom(state: unknown): BoatNotice | undefined {
  const notice = field(state, 'notice')
  return notice === 'created' || notice === 'saved' ? notice : undefined
}
