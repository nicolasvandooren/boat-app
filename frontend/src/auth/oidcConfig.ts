import type { AuthProviderProps } from 'react-oidc-context'

// Defaults match docker-compose.yml; override at build time with VITE_OIDC_* variables.
const authority = import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8081/realms/boatapp'
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID ?? 'boat-frontend'

export const oidcConfig: AuthProviderProps = {
  authority,
  client_id: clientId,
  redirect_uri: `${window.location.origin}/`,
  // Public page that does not sign in again automatically (see App routes).
  post_logout_redirect_uri: `${window.location.origin}/signed-out`,
  response_type: 'code',
  scope: 'openid profile',
  // Remove ?code=&state= from the URL once the login callback has been processed.
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}
