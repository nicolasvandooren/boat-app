# Boat App — Frontend

React 19 + TypeScript SPA built with Vite. It uses React Router, `react-oidc-context` for Keycloak login
(Authorization Code + PKCE) and TanStack Query for server state.

## Routes

| Path              | Access    | Purpose                                              |
| ----------------- | --------- | ---------------------------------------------------- |
| `/`               | protected | Redirects to `/boats`                                |
| `/boats`          | protected | Fleet overview: search and pagination                |
| `/boats/new`      | protected | Add a boat                                           |
| `/boats/:id`      | protected | Boat details                                         |
| `/boats/:id/edit` | protected | Edit a boat                                          |
| `/signed-out`     | public    | Shown after logout. It never signs in automatically. |
| anything else     | protected | "Page not found"                                     |

Opening a protected route without a session redirects to Keycloak. After login the app always lands on
`/boats`: the callback returns to `/`, and the deep link is not restored. Logout clears the query cache, ends
the Keycloak session and returns to `/signed-out`.

## Fleet overview

`/boats` calls `GET /api/boats?page&size=10&search` and shows each boat as a card with its name, description and
creation date. The boat name in each card is a link to its detail page. The link's `::after` stretches over the
card, so the whole card is clickable. There is one interactive element per card, with hover and focus styling on
the card.

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

## Boat details

`/boats/:id` calls `GET /api/boats/{id}` (`useBoat`/`fetchBoat`, query key `['boats', <subject>, 'detail', id]`)
and shows the name as the page `h1`, the description (or "No description") and the creation date.

- **Back to fleet:** the card link passes the list's query string as React Router location state
  (`{ listSearch }`), and "Back to fleet" returns to `/boats<listSearch>`, so search and page are kept. The state
  lives in the browser history entry, so it survives a refresh. A direct visit, or a new tab, falls back to
  `/boats`.
- **States:**
  - loading
  - "Boat not found" for a 404, and for an id that is not a UUID (no request is made)
  - 401 ("Sign in again", no automatic redirect)
  - network or 5xx ("Could not load this boat." with Retry)

  Backend error details aren't shown, except for the 400 detail on the list.

## Create and edit

"Add boat" (on the fleet, including the empty state) opens `/boats/new`; "Edit boat" on the detail page opens
`/boats/:id/edit`. Both use `BoatForm`.

- **What is sent** (`boatInput.ts`):
  - The name is trimmed, as the server does.
  - Only an empty description (`''`) is sent as `null`. Anything else, including whitespace-only text and line
    breaks, is sent exactly as entered.
  - Client validation checks that same body against the backend rules: a non-blank name of at most 150
    characters, a description of at most 2000, and no NUL characters. Lengths are counted in UTF-16 code units,
    as by the server.
- **The form:**
  - `noValidate`, so no browser bubbles.
  - Each field has a visible label, a hint and a counter, plus an inline error linked with `aria-invalid` and
    `aria-describedby`.
  - Focus moves to the first invalid field.
  - While saving, the fields and the button are disabled and a second submit is ignored. A failed save keeps
    the input.
- **Server errors:**
  - ProblemDetail errors for `name`/`description` appear inline.
  - Unknown fields, and a 400 without usable errors, appear in a focused form-level alert with a fallback
    message.
  - 401 offers "Sign in again" (no automatic redirect; unsaved input is lost).
  - 404 (deleted meanwhile) explains it and links to the fleet.
  - Network errors and 5xx ask the user to try again.
- **After saving**, the app goes to the boat's detail page, replacing the form in history. A focused status
  message confirms "Boat added." or "Changes saved.".
- **Cache:** the mutation stores the server's response under the detail key and invalidates every list query of
  the user (all pages and searches). There are no optimistic updates.
- **Cancel:**
  - From the add page it returns to the fleet page and search the user came from, or `/boats` on a direct visit.
  - From the edit page it returns to the boat.
  - The list context travels as location state (`navigation.ts`).

## Delete

"Delete boat" on the detail page opens an **inline confirmation**, "Delete “<name>”?". It deliberately isn't
`window.confirm()`, which blocks the page and can't be tested in jsdom.

- **Opening and closing:** the panel gets focus when it opens, so screen readers read the question and the
  "cannot be undone" description. **Cancel** or **Escape** closes it without any request and returns focus to
  "Delete boat".
- **While deleting:** "Delete permanently" and Cancel are disabled, the button reads "Deleting…", and repeat
  clicks are ignored.
- **After deleting** (`DELETE /api/boats/{id}`, 204), the app returns, replacing the detail page in history, to
  the fleet URL the user came from. A focused status message confirms "“<name>” was deleted.". The detail
  query of the signed-in subject is removed, and that subject's lists are invalidated. Other identities' cache
  entries are never touched.
- **Errors:**
  - 401 offers "Sign in again" (no automatic redirect).
  - 404 says the boat was already deleted, links to the fleet, and invalidates the lists.
  - Network errors and 5xx keep the confirmation open so the user can try again.

## Accessibility

- Skip link, `header`/`main` landmarks, one `h1` per page, and a page-specific document title.
- After client-side navigation to another page, focus moves to `<main>` and the page scrolls to the top.
  Search and pagination keep focus where it is.
- A visible 3 px teal focus ring. Status messages use `role="status"` and errors `role="alert"`.
- Automated checks: `src/test/axe.ts` runs axe-core's WCAG 2.0–2.2 A/AA rules. It is used for the fleet (with
  boats and empty) and the detail page (boat and not found). jsdom can't compute colour contrast, so contrast was
  measured in the browser instead (lowest text contrast 5.1:1).

  These checks don't prove WCAG compliance; a screen reader pass hasn't been done.

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
  features/boats/     types, api (queries; create/update/delete mutations), boatInput (body + validation),
                      navigation (list context in location state), BoatsPage, BoatSearch,
                      BoatDetailPage, DeleteBoat, BoatForm, NewBoatPage, EditBoatPage, LoadError
  components/         Layout (skip link, header, Log out, focus on navigation), useDocumentTitle
  pages/              NotFoundPage
  styles/             tokens.css (design tokens), global.css
  test/mockAuth.ts    useAuth / hasAuthParams test doubles
  test/axe.ts         axe-core helper for accessibility checks in tests
  test/boatRoutes.tsx renders the boat routes with the app's query client; fetch helpers
```

Tests mock `react-oidc-context` at the `useAuth`/`hasAuthParams` boundary, stub `fetch` with `vi.stubGlobal`,
and render routes with `MemoryRouter`.
