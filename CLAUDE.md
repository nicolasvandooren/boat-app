# CLAUDE.md — The Boat App

A small boat management app built for a time-boxed technical challenge. Priorities, in order:
**correctness, simplicity, security, reproducibility.** Architectural ambition is not a goal.

## Architecture rules

- One modular monolith backend (`backend/`, Spring Boot 3.5, Java 21) and one SPA (`frontend/`, React + Vite + TS).
- Backend is organized **by feature package**, not by technical layer:
  `com.boatapp.<feature>/` holds that feature's controller, service, repository, entity and DTOs.
  Cross-cutting config lives in `com.boatapp.config`.
- Do **not** introduce microservices, CQRS, event buses/queues, hexagonal ports/adapters, generic
  base repositories/services, or mapper frameworks. Add an abstraction only when a second concrete use exists.
- Database schema is owned by **Flyway** (`backend/src/main/resources/db/migration`). Hibernate runs with
  `ddl-auto: validate`. Never edit an applied migration; add a new one.
- The browser only talks to two origins: the frontend (`localhost:3000`, which proxies `/api` to the backend)
  and Keycloak (`localhost:8081`). There is no CORS config in the backend; keep it that way.

## Authentication invariants (do not break)

- Keycloak realm `boatapp`, public client `boat-frontend`, Authorization Code + PKCE (S256), no direct grants.
- Keycloak runs with `KC_HOSTNAME=http://localhost:8081`, so every token has
  `iss=http://localhost:8081/realms/boatapp` no matter which network path issued it.
- Backend validates **issuer** (`OIDC_ISSUER_URI`, public URL) and **audience** (`boat-api`, added by an audience
  mapper on the client) and fetches keys from `OIDC_JWK_SET_URI` (internal `keycloak:8080` URL in Docker).
  Do not switch to `issuer-uri` discovery: the backend container cannot reach `localhost:8081`.
- Security is deny-by-default: `anyRequest().authenticated()`; only `/actuator/health/**` is public.
- Stateless sessions, CSRF disabled (bearer tokens only, no cookies to the API).

## Coding conventions

### Java
- Constructor injection only; no field `@Autowired` in production code.
- Records for request/response DTOs; Bean Validation (`@Valid`, `@NotBlank`, …) on request DTOs.
- Never expose JPA entities from controllers.
- Errors as RFC 9457 `ProblemDetail` (enabled via `spring.mvc.problemdetails.enabled`); 400 for validation,
  404 for missing resources, 401/403 from Spring Security. No stack traces in responses.
- Formatting: google-java-format via Spotless (`./mvnw spotless:apply`). google-java-format is pinned to 1.36.1
  because 1.37.0 fails on JDK 21.

### TypeScript / React
- `strict` TypeScript, no `any`, function components and hooks only.
- Routing with React Router; auth via `react-oidc-context` (`useAuth`).
- Every data-fetching view handles loading, error and empty states explicitly.
- Cached data wins over a later error: when a background refetch fails, TanStack keeps `data` and sets `error`.
  Keep rendering the data (and any form built on it) and show the failure alongside it (`LoadError` with
  `stale`). Never unmount a form with unsaved input because of a refetch error.
- API calls go through `src/api/client.ts` with the bearer token; relative `/api/...` URLs only.
- Prettier (no semicolons, single quotes, width 100) and ESLint must pass.
- Structure: `src/App.tsx` (routes), `src/auth/` (OIDC config, `RequireAuth`, `SignedOutPage`),
  `src/components/` (shared UI such as `Layout`), `src/styles/` (`tokens.css` design tokens, `global.css`).
  Boat UI goes in `src/features/boats/`. Extract a component only when it is reused or clearly separates concerns.
- Server state lives in TanStack Query, never copied into component state. Query keys for user data are
  `[feature, sub, ...]` (the subject at index 1). Logout calls `queryClient.clear()`. When the subject changes,
  `App.tsx` removes only queries of other subjects. Never `clear()` while the current user's queries are mounted:
  that strands them in a permanent loading state (seen when the session is restored on page load).
- List state (page, search) lives in the URL; `page` is zero-based like the API. The detail page gets the list's
  query string as location state (`{ listSearch }`) for "Back to fleet", falling back to `/boats`. Don't add
  global state for navigation context.
- nginx: HTML is `Cache-Control: no-cache`, hashed `/assets/*` are immutable, and missing assets return 404.
  Keep this when changing `frontend/nginx.conf`.
- Styling: CSS Modules per component plus the global tokens. No UI framework. Text colors must keep ≥ 4.5:1 contrast.

### Authentication flow (frontend, do not break)
- The `oidcConfig.ts` callback (`history.replaceState`, which removes `code`/`state`) and the sessionStorage user
  store stay as they are. `BrowserRouter` stays. Login always returns to `/` → `/boats`, with no deep-link restore.
- Protected routes sit under `RequireAuth`. It never redirects while callback params are present
  (`hasAuthParams()`), while loading, or on `auth.error`, and it redirects at most once per mount
  (a ref guard, so StrictMode is safe).
- `/signed-out` is public and must never sign in automatically. Keycloak's post-logout redirect points to it.
- An API 401 must not trigger an automatic redirect. Offer a user-initiated "Sign in again" instead.

### Lint
- ESLint 10 flat config. The official `eslint-config-airbnb` (ESLint ≤ 8), `eslint-config-airbnb-extended`
  (ESLint 9) and `eslint-plugin-jsx-a11y` (ESLint ≤ 9) are incompatible, so the setup is: typescript-eslint
  `strictTypeChecked`, react-hooks, `eslint-plugin-jsx-a11y-x` (verified to report missing `alt` and
  non-interactive click handlers), and the essential non-formatting Airbnb rules listed in `eslint.config.js`.
- Do not downgrade ESLint or force peer dependencies. Do not disable rules broadly; fix the code or justify a
  narrow exception.

### Accessibility (target WCAG 2.2 AA)
- Semantic landmarks (`header`, `main`), one `h1` per page, a skip link, a visible `:focus-visible` ring.
- Status messages use `role="status"` and errors use `role="alert"`. Every control has an accessible name. No unnecessary ARIA.
- Each page sets a document title (`useDocumentTitle`). After client-side navigation, `Layout` moves focus to `<main>`.
- Card pattern: one link (the title) per card, stretched with `::after`; no nested interactive elements.
- **Forms** (`BoatForm`):
  - Use `noValidate` and validate the exact body that will be sent, mirroring the backend's Bean Validation.
  - Each field gets a visible label and hint, and an inline error linked with `aria-invalid` and
    `aria-describedby`.
  - Focus the first invalid field; a form-level alert gets focus when no field matches.
  - Disable fields and submit while a mutation is pending. Never drop the user's input on failure.
- **Mutations:**
  - No optimistic updates.
  - On success, `setQueryData` the server response under `['boats', sub, 'detail', id]` and invalidate
    `['boats', sub, 'list']`.
  - Navigate with `replace` so Back doesn't return to a submitted form.
- **Deletes:**
  - Confirm inline, never with `window.confirm()`: focus moves into the panel, Cancel/Escape send nothing and
    return focus, and controls are disabled while pending.
  - On success, remove only `['boats', sub, 'detail', id]` (`exact: true`), invalidate `['boats', sub, 'list']`,
    and navigate away with `replace`.
- Pages can mark an element with `data-focus-on-navigate` (and `tabIndex={-1}`); `Layout` focuses it instead of
  `<main>` after navigation.
- Route tests render through `src/test/boatRoutes.tsx`, which uses `createQueryClient()` (real `staleTime`, no
  retries). A bare `new QueryClient()` has `staleTime: 0` and causes refetches the app never makes.
- Use `axeViolations()` from `src/test/axe.ts` for representative states of new pages. Automated checks (lint
  and axe) do not prove compliance; keyboard, contrast and screen reader behavior need manual checks.

### General
- Pin exact versions: Docker image tags, npm deps (`save-exact`), Maven plugins.
- Secrets never go in the repo. The demo user (`demo`/`demo`) and default admin/DB passwords are
  **local development only** and live in `keycloak/realm-boatapp.json` / `.env.example`.
- Small, focused commits. Never push without asking.
- Any API contract change (endpoints, request/response fields, status codes, validation rules, error format)
  must update `backend/README.md` in the same iteration.
- Planning phases must not modify project files unless explicitly authorized. Only the plan itself may be
  written; implementation starts after the plan is approved.

## Commands

| Task | Command |
|---|---|
| Full stack | `docker compose up --build` |
| Backend format / test (JDK 21) | `cd backend && ./mvnw spotless:check verify` |
| Backend without local JDK 21 | `docker run --rm -v "$PWD/backend":/w -w /w -v /var/run/docker.sock:/var/run/docker.sock -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal maven:3.9.16-eclipse-temurin-21 ./mvnw spotless:check verify` |
| Frontend checks | `cd frontend && npm ci && npm run format:check && npm run lint && npm test && npm run build` |

Persistence tests use Testcontainers (`postgres:17.9-alpine`, same image as compose), so Docker must be running.
Tests that deliberately violate a DB constraint must end at the failing flush (PostgreSQL aborts the transaction).

## CI (`.github/workflows/backend.yml`, `frontend.yml`)

- Two independent workflows, triggered by native `paths` filters on `push` (to `main`) and `pull_request`, plus
  `workflow_dispatch` for a manual full run. Keep the `push` and `pull_request` path lists identical.
- Paths list exactly what each workflow's commands read:
  - backend: `backend/**` except `backend/**.md`, plus its own workflow file
  - frontend: `frontend/**`, including Markdown (Prettier checks it), `.editorconfig` (Prettier reads it), plus its
    own workflow file
  - When a check starts reading a new file outside these paths, add the file to the workflow's paths.
- `docker-compose.yml`, `keycloak/`, `.env.example` and root docs trigger no workflow: no CI command validates them.
- **Branch protection:** a workflow skipped by its path filter reports no checks. A required check from it then
  stays "Expected — Waiting for status to be reported", and a docs-only PR blocks on every required check. Don't
  make these checks required unless bypassing for unrelated PRs is acceptable. Check names: "Backend (format,
  test, build)", "Docker images (backend)", "Frontend (format, lint, test, build)", "Docker images (frontend)".
- No custom change-detection scripts and no third-party path-filter actions (a deliberate choice; see `AI_USAGE.md`).

## Definition of done / acceptance criteria

A change is done only when it was **executed and verified**, not just written:

1. OIDC login redirects to Keycloak and back to the boat overview.
2. Boat list is authenticated and paginated.
3. Create, view, update and delete a boat work end to end.
4. UI is responsive, uses routing, validates forms, shows loading and error states.
5. REST API returns proper status codes (200/201/204/400/401/404) with `ProblemDetail` bodies, and rejects
   unauthenticated requests.
6. `docker compose up --build` from a clean checkout starts everything healthy.
7. CI is green for every workflow the change triggers: formatting, tests, application builds, Docker image builds.
8. `README.md` and `AI_USAGE.md` are updated in the same change that alters behavior or decisions.
