import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { apiGet, apiSend } from '../../api/client'
import type { BoatInput } from './boatInput'
import type { Boat, BoatPage } from './types'

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Boat ids are UUIDs; anything else cannot exist, so it is shown as "not found" without a request. */
export function isBoatId(id: string | undefined): id is string {
  return id !== undefined && UUID.test(id)
}

export function fetchBoat(id: string, accessToken: string, signal?: AbortSignal): Promise<Boat> {
  return apiGet<Boat>(`/api/boats/${encodeURIComponent(id)}`, accessToken, signal)
}

export function useBoat(id: string) {
  const { user } = useAuth()
  const accessToken = user?.access_token
  const subject = user?.profile.sub

  return useQuery({
    // Same user-scoped convention as the list: [feature, subject, ...] (see App.tsx).
    queryKey: ['boats', subject, 'detail', id],
    queryFn: ({ signal }) => {
      if (!accessToken) throw new Error('Not signed in')
      return fetchBoat(id, accessToken, signal)
    },
    enabled: Boolean(accessToken && subject),
  })
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

/**
 * Shared success handling for create and update: store the saved boat returned by the server under its detail
 * key, and mark every cached list page and search of this user stale so it refetches. No optimistic updates.
 */
function useBoatMutation(send: (input: BoatInput, accessToken: string) => Promise<Boat>) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const accessToken = user?.access_token
  const subject = user?.profile.sub

  return useMutation({
    mutationFn: (input: BoatInput) => {
      if (!accessToken) throw new Error('Not signed in')
      return send(input, accessToken)
    },
    onSuccess: async (boat) => {
      queryClient.setQueryData(['boats', subject, 'detail', boat.id], boat)
      await queryClient.invalidateQueries({ queryKey: ['boats', subject, 'list'] })
    },
  })
}

export function useCreateBoat() {
  return useBoatMutation((input, accessToken) =>
    apiSend<Boat>('POST', '/api/boats', accessToken, input),
  )
}

export function useUpdateBoat(id: string) {
  return useBoatMutation((input, accessToken) =>
    apiSend<Boat>('PUT', `/api/boats/${encodeURIComponent(id)}`, accessToken, input),
  )
}
