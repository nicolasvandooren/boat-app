import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import { BrowserRouter } from 'react-router'
import App from './App'
import { oidcConfig } from './auth/oidcConfig'
import { createQueryClient } from './queryClient'
import './styles/tokens.css'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

const queryClient = createQueryClient()

createRoot(root).render(
  <StrictMode>
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
)
