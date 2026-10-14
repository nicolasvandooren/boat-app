/** `BoatResponse` in backend/README.md. */
export interface Boat {
  id: string
  name: string
  description: string | null
  /** ISO-8601 instant, e.g. `2026-10-13T13:43:07.541001Z`. */
  createdAt: string
}

/** `BoatPageResponse` in backend/README.md. `page` is zero-based. */
export interface BoatPage {
  content: Boat[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
