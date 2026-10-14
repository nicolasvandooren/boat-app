# Boat App — Frontend

React 19 + TypeScript SPA built with Vite. It uses React Router, `react-oidc-context` for Keycloak login
(Authorization Code + PKCE) and TanStack Query for server state.

## Routes

| Path          | Access    | Purpose                                              |
| ------------- | --------- | ---------------------------------------------------- |
| `/`           | protected | Redirects to `/boats`                                |
| `/boats`      | protected | Fleet overview (placeholder until iteration 3A.2)    |
| `/signed-out` | public    | Shown after logout. It never signs in automatically. |
| anything else | protected | "Page not found"                                     |

Opening a protected route without a session redirects to Keycloak. After login the app always lands on
`/boats`: the callback returns to `/`, and the deep link is not restored. Logout clears the query cache, ends
the Keycloak session and returns to `/signed-out`.

## Development

```bash
npm ci
npm run dev          # http://localhost:5173, proxies /api to http://localhost:8080
```

The backend and Keycloak must be running (see the root `README.md`). In Docker Compose the app is served by
nginx on http://localhost:3000, which proxies `/api` to the backend.

## Checks

```bash
npm run format:check # Prettier (npm run format to fix)
npm run lint         # ESLint 10: typescript-eslint strict (type-aware), react-hooks, jsx-a11y-x, Airbnb essentials
npm run typecheck    # tsc -b
npm test             # Vitest + React Testing Library (jsdom)
npm run build        # type-check and production build
```

CI runs format, lint, test and build (`.github/workflows/ci.yml`).

## Structure

```
src/
  main.tsx            providers: AuthProvider > QueryClientProvider > BrowserRouter
  App.tsx             routes; clears the query cache when the signed-in user changes
  queryClient.ts      retries only network errors and 5xx
  api/client.ts       fetch wrapper that adds the bearer token
  auth/               oidcConfig, RequireAuth (automatic login), SignedOutPage
  components/         Layout (skip link, header, Log out)
  pages/              BoatsPage (placeholder), NotFoundPage
  styles/             tokens.css (design tokens), global.css
  test/mockAuth.ts    useAuth / hasAuthParams test doubles
```

Tests mock `react-oidc-context` at the `useAuth`/`hasAuthParams` boundary and render routes with `MemoryRouter`.
