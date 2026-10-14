# Boat App — Frontend

React 19 + TypeScript SPA built with Vite. It uses React Router, `react-oidc-context` for Keycloak login
(Authorization Code + PKCE) and TanStack Query for server state.

## Routes

| Path          | Access    | Purpose                                              |
| ------------- | --------- | ---------------------------------------------------- |
| `/`           | protected | Redirects to `/boats`                                |
| `/boats`      | protected | Fleet overview: search and pagination                |
| `/signed-out` | public    | Shown after logout. It never signs in automatically. |
| anything else | protected | "Page not found"                                     |

Opening a protected route without a session redirects to Keycloak. After login the app always lands on
`/boats`: the callback returns to `/`, and the deep link is not restored. Logout clears the query cache, ends
the Keycloak session and returns to `/signed-out`.

## Fleet overview

`/boats` calls `GET /api/boats?page&size=10&search` and shows each boat as a card with its name, description and
creation date. Cards aren't links yet; the detail page comes in iteration 3A.3.

| URL parameter | Meaning                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `page`        | Zero-based, as in the API. It is left out for page 0. Invalid values are treated as page 0.    |
| `search`      | Case-insensitive match on name or description, done by the backend. It is left out when empty. |

- **Search** is debounced (300 ms) and applied straight away on Enter. A new search removes `page` and replaces
  the history entry. Pagination links add history entries, so back and forward work. The input follows the URL
  when it changes from outside (back, forward, Clear search) but is never reset while you type.
- **Caching** uses the query key `['boats', <subject>, 'list', { page, search }]`. The previous page stays
  visible while the next one loads. Results of a different search are never shown; a loading state appears
  instead.
- **States:**
  - loading
  - empty fleet
  - no search results (with Clear search)
  - page past the end (with a link to the first page)
  - 401 ("Sign in again", no automatic redirect)
  - other errors (Retry; a 400 also shows the ProblemDetail `detail`)

## Caching (nginx)

| Path                                  | `Cache-Control`                       | Why                                                       |
| ------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| HTML (`/`, `/index.html`, SPA routes) | `no-cache`                            | Revalidated (ETag, 304), so a new deployment is picked up |
| `/assets/*` (content-hashed)          | `public, max-age=31536000, immutable` | File names change on every build                          |
| missing `/assets/*`                   | none, **404**                         | Never falls back to `index.html`                          |

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
  App.tsx             routes; drops other users' cached queries when the signed-in subject changes
  queryClient.ts      retries only network errors and 5xx
  api/client.ts       fetch wrapper: bearer token, AbortSignal, ProblemDetail title/detail in ApiError
  auth/               oidcConfig, RequireAuth (automatic login), SignedOutPage
  components/         Layout (skip link, header, Log out)
  features/boats/     types, api (useBoats, URL params), BoatsPage, BoatSearch
  pages/              NotFoundPage
  styles/             tokens.css (design tokens), global.css
  test/mockAuth.ts    useAuth / hasAuthParams test doubles
```

Tests mock `react-oidc-context` at the `useAuth`/`hasAuthParams` boundary, stub `fetch` with `vi.stubGlobal`,
and render routes with `MemoryRouter`.
