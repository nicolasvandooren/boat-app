import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAuth } from 'react-oidc-context'
import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { SignedOutPage } from './auth/SignedOutPage'
import { Layout } from './components/Layout'
import { BoatsPage } from './features/boats/BoatsPage'
import { NotFoundPage } from './pages/NotFoundPage'

/** Drops cached server data whenever the signed-in identity changes or the session ends. */
function useClearCacheOnIdentityChange() {
  const queryClient = useQueryClient()
  const subject = useAuth().user?.profile.sub
  const previous = useRef(subject)

  useEffect(() => {
    if (previous.current !== subject) {
      previous.current = subject
      queryClient.clear()
    }
  }, [queryClient, subject])
}

export default function App() {
  useClearCacheOnIdentityChange()

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="signed-out" element={<SignedOutPage />} />
        <Route element={<RequireAuth />}>
          <Route index element={<Navigate to="/boats" replace />} />
          <Route path="boats" element={<BoatsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
