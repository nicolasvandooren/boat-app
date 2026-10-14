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
- API calls go through `src/api/client.ts` with the bearer token; relative `/api/...` URLs only.
- Prettier (no semicolons, single quotes, width 100) and ESLint must pass.

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

## Definition of done / acceptance criteria

A change is done only when it was **executed and verified**, not just written:

1. OIDC login redirects to Keycloak and back to the boat overview.
2. Boat list is authenticated and paginated.
3. Create, view, update and delete a boat work end to end.
4. UI is responsive, uses routing, validates forms, shows loading and error states.
5. REST API returns proper status codes (200/201/204/400/401/404) with `ProblemDetail` bodies, and rejects
   unauthenticated requests.
6. `docker compose up --build` from a clean checkout starts everything healthy.
7. CI is green: formatting, tests, application builds, Docker image builds.
8. `README.md` and `AI_USAGE.md` are updated in the same change that alters behavior or decisions.
