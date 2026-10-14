import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api/client'

const MAX_RETRIES = 2

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Client errors (400/401/404) will not succeed on retry; network errors and 5xx might.
        retry: (failureCount, error) =>
          failureCount < MAX_RETRIES && !(error instanceof ApiError && error.status < 500),
      },
    },
  })
}
