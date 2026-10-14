import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { apiGet } from '../../api/client'
import type { BoatPage } from './types'

export const PAGE_SIZE = 10
/** The backend's upper bound for `page` (backend/README.md). */
const MAX_PAGE = 21474836

export interface BoatListParams {
  /** Zero-based, like the API. */
  page: number
  /** Trimmed; empty means no filter. */
  search: string
}

/** Reads `?page=&search=` from the URL. Anything that is not a valid page number means page 0. */
export function parseListParams(searchParams: URLSearchParams): BoatListParams {
  const rawPage = searchParams.get('page') ?? ''
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 0
  return {
    page: page <= MAX_PAGE ? page : 0,
    search: (searchParams.get('search') ?? '').trim(),
  }
}

export function useBoats({ page, search }: BoatListParams) {
  const { user } = useAuth()
  const accessToken = user?.access_token
  const subject = user?.profile.sub

  return useQuery({
    // The subject keeps one user's cached boats from ever being served to another.
    queryKey: ['boats', subject, 'list', { page, search }],
    queryFn: ({ signal }) => {
      if (!accessToken) throw new Error('Not signed in')
      const query = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
      if (search) query.set('search', search)
      return apiGet<BoatPage>(`/api/boats?${query.toString()}`, accessToken, signal)
    },
    enabled: Boolean(accessToken && subject),
    // Keep the current page visible while the next page loads, but never show results of another search.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3]?.search === search ? previous : undefined,
  })
}
