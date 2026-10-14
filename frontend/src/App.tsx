import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { SignedOutPage } from './auth/SignedOutPage'
import { Layout } from './components/Layout'
import { BoatDetailPage } from './features/boats/BoatDetailPage'
import { BoatsPage } from './features/boats/BoatsPage'
import { NotFoundPage } from './pages/NotFoundPage'

/**
 * Drops cached data of any other identity when the signed-in subject changes or the session ends.
 * User data is keyed `[feature, subject, ...]`, so the current user's queries, including ones already
 * in flight while the session is being restored, are never removed (clear() would strand them).
 */
function useDropOtherUsersCache() {
  const queryClient = useQueryClient()
  const subject = useAuth().user?.profile.sub

  useEffect(() => {
    queryClient.removeQueries({ predicate: (query) => query.queryKey[1] !== subject })
  }, [queryClient, subject])
}

export default function App() {
  useDropOtherUsersCache()

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="signed-out" element={<SignedOutPage />} />
        <Route element={<RequireAuth />}>
          <Route index element={<Navigate to="/boats" replace />} />
          <Route path="boats" element={<BoatsPage />} />
          <Route path="boats/:id" element={<BoatDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
